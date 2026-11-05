import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalService } from '@deepseek-ai/dsh-user-approval';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { assemble, enabledConfig, fixturePlugin, fixtureTool, hostFixture, success } from './fixture.js';

const run = (host, agent, code, signal) => host.execute('run_code', { code, description: 'Run harmless discovery fixture tool checks' }, { agent, ...(signal ? { signal } : {}) });

let unavailableSandbox;
async function requireNodeSandbox(t, host, agent) {
  if (!unavailableSandbox) {
    const probe = await run(host, agent, 'return "read-only fixture confinement probe";');
    if (probe.isError && /sandbox-unavailable/.test(probe.error.message)) unavailableSandbox = probe.error.message;
    else success(probe);
  }
  if (!unavailableSandbox) return true;
  t.diagnostic(unavailableSandbox);
  t.skip('real Node PTC unavailable: local sandbox runner cannot apply confinement; no unconfined fallback');
  return false;
}

test('real NodePtcRuntime run_code discovers, then invokes original omitted binding through host scheduler', { timeout: 30000 }, async t => {
  const host = await hostFixture(t, { node: true });
  const { ctx, tools, agent, calls, events } = host;
  const a = agent('node');
  if (!await requireNodeSandbox(t, host, a)) return;
  a.ctx.tools.restrict({ deny: ['ego_secret'] });
  const before = renderPrompt(await assemble(ctx, a));
  const discovery = success(await run(host, a, 'return await tools.unwrap({plugin: "dsh-ego-browser"});'));
  assert.deepEqual([...discovery.result.tools].sort(), ['ego_capture', 'ego_visit']);
  assert.match(discovery.result.sdk, /globalMarker: string/);
  assert.equal(calls.length, 0);
  const seen = [];
  ctx.on('tools/pre-execute', async (exec, next) => { seen.push({ stage: 'pre', exec }); return next(); });
  ctx.on('tools/execute', async (exec, next) => { seen.push({ stage: 'around', exec }); return next(); });
  ctx.on('tools/post-execute', async (exec, _result, next) => { seen.push({ stage: 'post', exec }); return next(); });
  const value = success(await run(host, a, 'return await tools.ego_visit({input: "discovered safe value"});'));
  assert.deepEqual(value.result, { globalMarker: 'discovered safe value', details: { values: [1, 2] } });
  assert.deepEqual(calls, [{ name: 'ego_visit', input: 'discovered safe value' }]);
  const nested = seen.filter(item => item.exec.name === 'ego_visit');
  assert.deepEqual(nested.map(item => item.stage), ['pre', 'around', 'post']);
  for (const { exec } of nested) {
    assert.equal(exec.agent, a);
    assert.equal(typeof exec.parent, 'symbol');
    assert.match(exec.callId, /:ptc:1$/);
    assert.equal(exec.rootCallId, exec.callId.split(':ptc:')[0]);
  }
  assert.ok(events.some(event => event.type === 'tool/ptc-dispatch-start' && event.data.name === 'ego_visit'));
  assert.ok(events.some(event => event.type === 'tool/ptc-dispatch' && event.data.name === 'ego_visit' && !event.data.isError));
  const unavailable = success(await run(host, a, 'return {binding: typeof tools.ego_secret, discovery: await tools.unwrap({plugin: "dsh-ego-browser"})};'));
  assert.equal(unavailable.result.binding, 'undefined');
  assert.deepEqual([...unavailable.result.discovery.tools].sort(), ['ego_capture', 'ego_visit']);
  assert.doesNotMatch(unavailable.result.discovery.sdk, /ego_secret:/);
  assert.doesNotMatch(JSON.stringify(unavailable), /RESTRICTED_SECRET_DESCRIPTION/);
  assert.equal(renderPrompt(await assemble(ctx, a)), before);
  assert.ok(tools.get('ego_visit', a));
});

test('real run_code uses scoped shadow definitions and cannot bypass original guard or real approval', { timeout: 30000 }, async t => {
  const host = await hostFixture(t, { node: true, config: enabledConfig({ exclude: ['ego_capture', 'ego_secret'] }) });
  const { ctx, tools, agent, calls, events } = host;
  const a = agent('node-policy');
  if (!await requireNodeSandbox(t, host, a)) return;
  await fixturePlugin(a.ctx, 'dsh-ego-browser', [fixtureTool('ego_visit', { description: 'Node scoped shadow browser', marker: 'nodeShadowMarker' })]);
  const info = success(await run(host, a, 'return await tools.unwrap({plugin: "dsh-ego-browser"});'));
  assert.match(info.result.sdk, /nodeShadowMarker: string/);
  assert.doesNotMatch(info.result.sdk, /globalMarker/);
  const shadow = success(await run(host, a, 'return await tools.ego_visit({input: "shadow value"});'));
  assert.equal(shadow.result.nodeShadowMarker, 'shadow value');
  assert.equal(calls.length, 0, 'global shadowed implementation must never run');
  const disposeGuard = tools.guard(exec => exec.name === 'ego_visit' ? 'original host guard remains enforced' : undefined);
  const blocked = success(await run(host, a, 'try { await tools.ego_visit({input: "blocked"}); return "unexpected"; } catch (e) { return {message: e.message, toolName: e.toolName}; }'));
  assert.match(blocked.result.message, /original host guard remains enforced/);
  assert.equal(blocked.result.toolName, 'ego_visit');
  disposeGuard();
  await ctx.plugin(ApprovalService, { policy: 'ask' });
  ctx.on('tools/pre-execute', async (exec, next) => exec.name === 'ego_visit' ? { kind: 'ask', reason: 'original nested approval' } : next());
  const outcomes = ['rejected', 'allowed-once'];
  ctx.on('approval/request', async () => outcomes.shift());
  const rejected = success(await run(host, a, 'try { return await tools.ego_visit({input: "rejected"}); } catch (e) { return {message: e.message}; }'));
  assert.match(rejected.result.message, /user rejected/);
  const approved = success(await run(host, a, 'return await tools.ego_visit({input: "approved"});'));
  assert.equal(approved.result.nodeShadowMarker, 'approved');
  assert.deepEqual(events.filter(event => event.type === 'approval/decided').map(event => event.data.outcome), ['rejected', 'allowed-once']);
});

test('real run_code cancellation reaches nested tool signal and drains the body before returning', { timeout: 30000 }, async t => {
  const host = await hostFixture(t, { node: true });
  const { tools, agent, execute } = host;
  const a = agent('node-cancellation');
  if (!await requireNodeSandbox(t, host, a)) return;
  const entered = Promise.withResolvers();
  let settled = false;
  await fixturePlugin(host.ctx, 'dsh-ego-browser', [fixtureTool('ego_wait', { execute: async (_args, exec) => {
    entered.resolve(exec);
    await new Promise(resolve => {
      if (exec.signal.aborted) resolve();
      else exec.signal.addEventListener('abort', resolve, { once: true });
    });
    settled = true;
    return { globalMarker: 'drained', details: { values: [] } };
  } })]);
  success(await run(host, a, 'return await tools.unwrap({plugin: "dsh-ego-browser"});'));
  const controller = new AbortController();
  const pending = run(host, a, 'return await tools.ego_wait({input: "wait"});', controller.signal);
  const nested = await entered.promise;
  controller.abort(new Error('cancel the owned fixture run'));
  const result = await pending;
  assert.equal(result.isError, true);
  // rc.1 normalizes caller cancellation to ABORTED after draining nested bodies.
  assert.equal(result.error.info.code, 'ABORTED');
  assert.equal(result.error.message, 'tool call aborted');
  assert.equal(nested.signal.aborted, true);
  assert.equal(settled, true);
  const already = new AbortController();
  already.abort();
  const before = await execute('run_code', { code: 'return 1;', description: 'Check pre-dispatch cancellation remains effective' }, { agent: a, signal: already.signal });
  assert.equal(before.error.info.code, 'ABORTED_BEFORE_DISPATCH');
});

test('host PTC scheduler keeps opted-in parallel overlap and exclusive barriers after discovery', { timeout: 30000 }, async t => {
  const host = await hostFixture(t, { node: true });
  const { tools, agent } = host;
  const a = agent('node-scheduling');
  if (!await requireNodeSandbox(t, host, a)) return;
  const trace = [];
  let concurrent = 0;
  let maximum = 0;
  let parallelStarted = 0;
  const bothStarted = Promise.withResolvers();
  await fixturePlugin(host.ctx, 'dsh-ego-browser', [fixtureTool('ego_parallel', { safe: true, execute: async args => {
    trace.push(`start:${args.input}`);
    maximum = Math.max(maximum, ++concurrent);
    if (++parallelStarted === 2) bothStarted.resolve();
    await bothStarted.promise;
    concurrent--;
    trace.push(`end:${args.input}`);
    return { globalMarker: args.input, details: { values: [] } };
  } })]);
  await fixturePlugin(host.ctx, 'dsh-ego-browser', [fixtureTool('ego_exclusive', { execute: async args => {
    assert.equal(concurrent, 0, 'exclusive calls run only after parallel bodies drain');
    trace.push('exclusive');
    return { globalMarker: args.input, details: { values: [] } };
  } })]);
  success(await run(host, a, 'return await tools.unwrap({plugin: "dsh-ego-browser"});'));
  const result = success(await run(host, a, 'return await Promise.all([tools.ego_parallel({input: "one"}), tools.ego_parallel({input: "two"}), tools.ego_exclusive({input: "barrier"})]);'));
  assert.equal(maximum, 2);
  assert.deepEqual(result.result.map(value => value.globalMarker), ['one', 'two', 'barrier']);
  assert.equal(trace.at(-1), 'exclusive');
  assert.equal(trace.length, 5);
});
