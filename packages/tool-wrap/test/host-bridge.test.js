import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalService } from '@deepseek-ai/dsh-user-approval';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { assemble, enabledConfig, fixturePlugin, fixtureTool, hostFixture, success } from './fixture.js';

function program(host, agent, name, body, signal) {
  host.ctx.get('ptcRuntime').programs.set(name, body);
  return host.execute('run_code', { code: name, description: 'Exercise controlled host tool binding fixture' }, { agent, ...(signal ? { signal } : {}) });
}

test('original run_code host binding discovers then calls omitted tool through real scoped registry scheduler', async t => {
  const host = await hostFixture(t, { bridge: true });
  const { ctx, tools, agent, calls, events } = host;
  const a = agent('host-bridge');
  a.ctx.tools.restrict({ deny: ['ego_secret'] });
  const before = renderPrompt(await assemble(ctx, a));
  // rc.1's run_code is provider-owned transport, not an end-tool registration.
  assert.deepEqual((await assemble(ctx, a)).tools.map(tool => tool.name), ['run_code']);
  assert.equal(tools.get('run_code', a), undefined);
  const discovery = success(await program(host, a, 'discover visit', tools => tools.discover_tools({ plugin: 'dsh-ego-browser' })));
  assert.deepEqual([...discovery.result.tools].sort(), ['ego_capture', 'ego_visit']);
  assert.match(discovery.result.sdk, /globalMarker: string/);
  assert.equal(calls.length, 0);
  const trace = [];
  for (const event of ['tools/pre-execute', 'tools/execute']) ctx.on(event, async (exec, next) => { if (exec.name === 'ego_visit') trace.push({ event, exec }); return next(); });
  ctx.on('tools/post-execute', async (exec, _result, next) => { if (exec.name === 'ego_visit') trace.push({ event: 'tools/post-execute', exec }); return next(); });
  const result = success(await program(host, a, 'call visit', tools => tools.ego_visit({ input: 'safe bound value' })));
  assert.equal(result.result.globalMarker, 'safe bound value');
  assert.deepEqual(trace.map(item => item.event), ['tools/pre-execute', 'tools/execute', 'tools/post-execute']);
  for (const { exec } of trace) {
    assert.equal(exec.agent, a);
    assert.equal(typeof exec.parent, 'symbol');
    assert.match(exec.callId, /:ptc:1$/);
    assert.equal(exec.rootCallId, exec.callId.split(':ptc:')[0]);
  }
  const restricted = success(await program(host, a, 'restricted bindings', async tools => ({
    binding: typeof tools.ego_secret,
    discovery: await tools.discover_tools({ plugin: 'dsh-ego-browser' }),
  })));
  assert.equal(restricted.result.binding, 'undefined');
  assert.deepEqual([...restricted.result.discovery.tools].sort(), ['ego_capture', 'ego_visit']);
  assert.doesNotMatch(restricted.result.discovery.sdk, /ego_secret:/);
  assert.doesNotMatch(JSON.stringify(restricted), /RESTRICTED_SECRET_DESCRIPTION/);
  assert.ok(events.some(event => event.type === 'tool/ptc-dispatch-start' && event.data.name === 'ego_visit'));
  assert.ok(events.some(event => event.type === 'tool/ptc-dispatch' && event.data.name === 'ego_visit' && !event.data.isError));
  assert.equal(tools.get('run_code', a), undefined);
  assert.equal(renderPrompt(await assemble(ctx, a)), before);
});

test('original run_code binding resolves shadow and enforces monotonic guard plus real per-call approval', async t => {
  const host = await hostFixture(t, { bridge: true, config: enabledConfig({ exclude: ['ego_capture', 'ego_secret'] }) });
  const { ctx, tools, agent, calls, events } = host;
  const a = agent('host-policy');
  await fixturePlugin(a.ctx, 'dsh-ego-browser', [fixtureTool('ego_visit', { marker: 'hostShadowMarker' })]);
  const discovery = success(await program(host, a, 'discover shadow', tools => tools.discover_tools({ plugin: 'dsh-ego-browser' })));
  assert.match(discovery.result.sdk, /hostShadowMarker: string/);
  assert.doesNotMatch(discovery.result.sdk, /globalMarker/);
  const shadow = success(await program(host, a, 'shadow call', tools => tools.ego_visit({ input: 'shadow' })));
  assert.equal(shadow.result.hostShadowMarker, 'shadow');
  assert.deepEqual(calls, []);
  const guard = tools.guard(exec => exec.name === 'ego_visit' ? 'original host guard' : undefined);
  const denied = await program(host, a, 'guard denied', tools => tools.ego_visit({ input: 'must not run' }));
  assert.equal(denied.isError, true);
  assert.match(denied.error.message, /original host guard/);
  guard();
  await ctx.plugin(ApprovalService, { policy: 'ask' });
  ctx.on('tools/pre-execute', async (exec, next) => exec.name === 'ego_visit' ? { kind: 'ask', reason: 'fixture existing approval' } : next());
  const outcomes = ['rejected', 'allowed-once', 'unavailable'];
  ctx.on('approval/request', async () => outcomes.shift());
  const rejected = await program(host, a, 'approval rejected', tools => tools.ego_visit({ input: 'no' }));
  assert.equal(rejected.isError, true);
  assert.match(rejected.error.message, /user rejected/);
  const allowed = success(await program(host, a, 'approval once', tools => tools.ego_visit({ input: 'yes' })));
  assert.equal(allowed.result.hostShadowMarker, 'yes');
  const unavailable = await program(host, a, 'approval again', tools => tools.ego_visit({ input: 'must ask again' }));
  assert.equal(unavailable.isError, true);
  assert.match(unavailable.error.message, /no approval channel/);
  assert.deepEqual(events.filter(event => event.type === 'approval/decided').map(event => event.data.outcome), ['rejected', 'allowed-once', 'unavailable']);
});

test('original run_code host scheduler retains parallel overlap and exclusive barriers', { timeout: 5000 }, async t => {
  const host = await hostFixture(t, { bridge: true });
  const { tools, agent } = host;
  const a = agent('host-scheduler');
  const bothStarted = Promise.withResolvers();
  const trace = [];
  let active = 0;
  let started = 0;
  let maximum = 0;
  await fixturePlugin(host.ctx, 'dsh-ego-browser', [fixtureTool('ego_parallel', { safe: true, execute: async args => {
    trace.push(`start:${args.input}`);
    maximum = Math.max(maximum, ++active);
    if (++started === 2) bothStarted.resolve();
    await bothStarted.promise;
    active--;
    trace.push(`end:${args.input}`);
    return { globalMarker: args.input, details: { values: [] } };
  } })]);
  await fixturePlugin(host.ctx, 'dsh-ego-browser', [fixtureTool('ego_exclusive', { execute: async args => {
    assert.equal(active, 0);
    trace.push('exclusive');
    return { globalMarker: args.input, details: { values: [] } };
  } })]);
  success(await program(host, a, 'discover scheduling tools', tools => tools.discover_tools({ plugin: 'dsh-ego-browser' })));
  const result = success(await program(host, a, 'scheduled calls', tools => Promise.all([
    tools.ego_parallel({ input: 'one' }), tools.ego_parallel({ input: 'two' }), tools.ego_exclusive({ input: 'barrier' }),
  ])));
  assert.equal(maximum, 2);
  assert.deepEqual(result.result.map(value => value.globalMarker), ['one', 'two', 'barrier']);
  assert.equal(trace.at(-1), 'exclusive');
  assert.equal(trace.length, 5);
});

test('original run_code cancellation propagates to nested body and waits for quiescence', { timeout: 5000 }, async t => {
  const host = await hostFixture(t, { bridge: true });
  const { tools, agent, events } = host;
  const a = agent('host-cancel');
  const entered = Promise.withResolvers();
  let drained = false;
  await fixturePlugin(host.ctx, 'dsh-ego-browser', [fixtureTool('ego_wait', { execute: async (_args, exec) => {
    entered.resolve(exec);
    await new Promise(resolve => {
      if (exec.signal.aborted) resolve();
      else exec.signal.addEventListener('abort', resolve, { once: true });
    });
    drained = true;
    return { globalMarker: 'drained', details: { values: [] } };
  } })]);
  success(await program(host, a, 'discover wait', tools => tools.discover_tools({ plugin: 'dsh-ego-browser' })));
  const controller = new AbortController();
  const pending = program(host, a, 'wait for cancellation', tools => tools.ego_wait({ input: 'wait' }), controller.signal);
  const execution = await entered.promise;
  controller.abort(new Error('cancel fixture program'));
  const result = await pending;
  assert.equal(result.isError, true);
  assert.equal(result.error.info.code, 'ABORTED');
  assert.equal(result.error.message, 'tool call aborted');
  assert.equal(execution.signal.aborted, true);
  assert.equal(drained, true);
  const nested = events.find(event => event.type === 'tool/ptc-dispatch' && event.data.name === 'ego_wait');
  assert.equal(nested.data.isError, true);
  assert.equal(nested.data.error.code, 'ABORTED');
});


test('real PTC discovery and bindings share each caller conditional toolset', async t => {
  const host = await hostFixture(t, { bridge: true });
  const { ctx, tools, agent } = host;
  const a = agent('conditional-A');
  const b = agent('conditional-B');
  const owner = await fixturePlugin(ctx, 'dsh-ego-browser');
  const activations = [];
  owner.tools.register(fixtureTool('ego_conditional', { description: 'CONDITIONAL_A_ONLY' }), {
    when: ({ agent, modelSelection, signal }) => {
      assert.equal(modelSelection.provider, 'fixture');
      assert.equal(signal.aborted, false);
      activations.push(agent);
      return agent === a;
    },
  });
  for (const [caller, admitted] of [[a, true], [b, false]]) {
    const value = success(await program(host, caller, `conditional ${caller.id}`, async bindings => ({
      binding: typeof bindings.ego_conditional,
      pack: await bindings.discover_tools({ plugin: 'dsh-ego-browser' }),
    }))).result;
    assert.equal(value.binding, admitted ? 'function' : 'undefined');
    assert.equal(value.pack.tools.includes('ego_conditional'), admitted);
    assert.equal(value.pack.sdk.includes('CONDITIONAL_A_ONLY'), admitted);
    const prompt = renderPrompt(await assemble(ctx, caller));
    assert.equal(prompt.includes('CONDITIONAL_A_ONLY'), false); // deferred, never eager
  }
  assert.ok(activations.includes(a));
  assert.ok(activations.includes(b));
  assert.ok(tools.get('ego_conditional', b)); // registered inspection is not admission
});
