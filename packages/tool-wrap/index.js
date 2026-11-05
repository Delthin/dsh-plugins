import { defineTool } from '@deepseek-ai/dsh-tools';
import { registeredPlugins, toolOrigin } from './origins.js';
import { generationStatus, generateDescription } from './summaries.js';
import { ConfigStore, DiscoveryError, DISCOVER, LEGACY_DISCOVER, isDiscoveryTool, sdkSchemas, renderSdk, project, catalog, discover, digest } from './core.js';

export const name = 'tool-discovery';
export const inject = ['profileContext', 'tools', 'systemPrompt'];
const API = '/api/tool-discovery';

export async function apply(ctx) {
  const store = new ConfigStore(ctx.get('profileContext').dir);
  await store.load();
  const tools = ctx.get('tools');
  let lastAssembly = null;
  let discoveryCalls = 0;
  const runtime = () => ctx.get('ptcRuntime');
  const status = () => {
    const schemas = sdkSchemas(tools);
    const groups = catalog(schemas, store.config);
    // Only plugin identities, never another conversation's tool names or schemas.
    for (const plugin of registeredPlugins(tools)) {
      if (!groups.some(group => group.id === plugin.id)) {
        const developerDescription = plugin.description || '';
        const custom = Object.hasOwn(store.config.descriptions, plugin.id) ? store.config.descriptions[plugin.id] : undefined;
        groups.push({ ...plugin, description: custom || developerDescription, developerDescription,
          descriptionSource: custom ? 'custom' : developerDescription ? 'developer' : 'missing', tools: [], known: true, scopedOnly: true });
      }
    }
    groups.sort((a, b) => a.id.localeCompare(b.id));
    const grouped = new Set(groups.flatMap(group => group.tools.map(tool => tool.name)));
    const unknown = schemas.filter(tool => !isDiscoveryTool(tool.name) && !tool.plugin).length;
    return {
      config: structuredClone(store.config), groups,
      otherTools: schemas.filter(tool => !isDiscoveryTool(tool.name) && !grouped.has(tool.name)).map(tool => ({ name: tool.name, description: tool.description.slice(0, 150) })),
      estimate: project(schemas, store.config, runtime() ?? { language: 'typescript', programFormat: 'function-body' }).estimate,
      lastAssembly, discoveryCalls, generation: generationStatus(ctx),
      coverage: { known: schemas.filter(tool => !isDiscoveryTool(tool.name) && tool.plugin).length, unknown },
      warnings: unknown ? ['部分既有工具未记录注册来源，暂列为未识别来源；完整补齐需要在加载来源适配后重新注册或重启服务。'] : [],
    };
  };
  // Keep the old binding callable for existing sessions, never advertise it in projected SDKs.
  for (const toolName of [DISCOVER, LEGACY_DISCOVER]) tools.register(defineTool({
    name: toolName,
    description: 'Load an on-demand plugin tool pack by its exact plugin id. Returns all deferred tools in that plugin visible to the caller, with original full parameters, return types and usage instructions. No arguments lists plugin briefs, deferred tool names and counts. Use proactively when a task needs a listed tool; the user need not request unpacking. Return only one complete pack per run_code (prefer return await tools.unwrap({plugin: ...})); if printing, serialize the whole pack as JSON instead of console.log(object), which can truncate SDK strings. Then call the original tools in a later run_code. Does not execute tools, grant permissions, or change system prompts.',
    parameters: {
      plugin: { type: 'string', description: 'Exact plugin id from the on-demand overview. Load the whole caller-visible deferred tool pack in one call; no keyword search.' },
      tool: { type: 'string', description: 'Exact name of a deferred standalone tool without an identified plugin, as listed in the overview.' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute(args, execution) {
      // Never consult global schemas for a caller. Restriction and scoped shadowing must survive discovery.
      const result = discover(sdkSchemas(tools, execution.agent, execution.toolSet), store.config, runtime(), args);
      discoveryCalls++;
      return result;
    },
  }), { when: async ({ agent, signal }) => {
    signal.throwIfAborted();
    if (!store.config.enabled) return false;
    // Provider-owned wire schemas are authoritative. Assembly does not resolve
    // conditions, so inspecting the transport here cannot recurse into resolve().
    const assembly = await ctx.systemPrompt.assemble({ scope: agent });
    signal.throwIfAborted();
    return assembly.tools.length === 1 && assembly.tools[0].name === 'run_code';
  } });
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembly = await next();
    const mode = assembly.sections.some(section => section.name === 'tools:ptc-only' && section.text) ? 'ptc' : 'native';
    if (!store.config.enabled || mode !== 'ptc') {
      // Native and disabled admission is handled by register({ when }) above.
      // Unresolved inspection may still include discovery in the PTC SDK.
      let sections = assembly.sections;
      if (mode === 'ptc') {
        const schemas = sdkSchemas(tools, context.scope, context.toolSet);
        sections = sections.map(section => section.name === 'tools:sdk' && section.text === renderSdk(schemas, runtime())
          ? { ...section, text: renderSdk(schemas.filter(tool => !isDiscoveryTool(tool.name)), runtime()), interpolate: false } : section);
      }
      lastAssembly = { mode, status: store.config.enabled ? 'native-unchanged' : 'disabled', beforeChars: 0, afterChars: 0, savedChars: 0, hash: '', hiddenCount: 0 };
      return { ...assembly, sections };
    }
    const section = assembly.sections.find(section => section.name === 'tools:sdk');
    const schemas = sdkSchemas(tools, context.scope, context.toolSet);
    // Fail open to the existing presentation if another plugin owns this section,
    // or the caller cannot invoke the discovery tool. Never change runtime capability visibility.
    const exactSdk = section && section.text === renderSdk(schemas, runtime());
    if (!exactSdk || !schemas.some(tool => tool.name === DISCOVER)) {
      lastAssembly = { mode, status: 'incompatible-sdk', beforeChars: 0, afterChars: 0, savedChars: 0, hash: '', hiddenCount: 0 };
      // Still hide the compatibility binding when the primary transport is restricted.
      // Never rewrite another plugin's SDK or defer tools without a callable unwrap.
      return exactSdk ? { ...assembly, sections: assembly.sections.map(item => item === section
        ? { ...section, text: renderSdk(schemas.filter(tool => tool.name !== LEGACY_DISCOVER), runtime()), interpolate: false } : item) } : assembly;
    }
    const projected = project(schemas, store.config, runtime());
    const replacement = { ...section, text: projected.text, interpolate: false };
    lastAssembly = { mode, status: 'projected', ...projected.estimate, hash: digest(projected.text) };
    return { ...assembly, sections: assembly.sections.map(item => item === section ? replacement : item) };
  }, { prepend: true });

  // No raw prompts, tool arguments, session identifiers, or discovery state are retained.
  // The route is Host-local and uses the same authenticated, same-origin gate as existing settings.
  ctx.inject(['webServer', 'connection'], routeCtx => {
    const respond = (res, code, value) => {
      res.statusCode = code;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify(value));
    };
    async function handler(req, res) {
      const rejection = routeCtx.connection.requestRejection(req);
      if (rejection !== undefined) return respond(res, rejection, { error: { message: '请通过已登录的 DSH 同源页面访问' } });
      if (!['GET', 'PUT'].includes(req.method)) return respond(res, 405, { error: { message: '仅支持 GET 和 PUT' } });
      try {
        if (req.method === 'PUT') {
          if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new DiscoveryError('请求必须使用 application/json', 415);
          const chunks = []; let bytes = 0;
          for await (const chunk of req) {
            bytes += Buffer.byteLength(chunk);
            if (bytes > 65536) throw new DiscoveryError('请求最多 64 KiB', 413);
            chunks.push(Buffer.from(chunk));
          }
          let value;
          try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DiscoveryError('无效 JSON'); }
          if (value?.version !== 3) throw new DiscoveryError('配置页面已更新，请刷新后重新保存', 409);
          await store.save(value);
          // Explicit settings changes can change the prefix. Discovery itself never emits this event.
          ctx.emit('system-prompt/change');
        }
        return respond(res, 200, status());
      } catch (error) {
        const safe = error instanceof DiscoveryError ? error : new DiscoveryError('工具发现操作失败，请重试', 500);
        if (!res.destroyed) respond(res, safe.status, { error: { message: safe.message } });
      }
    }
    let generating = false;
    async function generationHandler(req, res) {
      const rejection = routeCtx.connection.requestRejection(req);
      if (rejection !== undefined) return respond(res, rejection, { error: { message: '请通过已登录的 DSH 同源页面访问' } });
      if (req.method !== 'POST') return respond(res, 405, { error: { message: '生成简介仅支持 POST' } });
      if (generating) return respond(res, 429, { error: { message: '正在生成简介，请稍后再试' } });
      let timer, controller;
      const disconnected = () => controller?.abort();
      try {
        if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new DiscoveryError('请求必须使用 application/json', 415);
        const chunks = []; let bytes = 0;
        for await (const chunk of req) {
          bytes += Buffer.byteLength(chunk);
          if (bytes > 65536) throw new DiscoveryError('请求最多 64 KiB', 413);
          chunks.push(Buffer.from(chunk));
        }
        let value;
        try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DiscoveryError('无效 JSON'); }
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['plugin', 'model'].includes(key))) throw new DiscoveryError('生成请求字段无效');
        if (generating) throw new DiscoveryError('正在生成简介，请稍后再试', 429);
        generating = true;
        controller = new AbortController();
        timer = setTimeout(() => controller.abort(), 120000);
        timer.unref();
        req.on('aborted', disconnected);
        res.on('close', disconnected);
        // Read only names and descriptions; generation never needs input/output schemas.
        const schemas = tools.definitions().flatMap(({ name, description }) => {
          const plugin = toolOrigin(tools, name);
          return plugin?.id === value.plugin ? [{ name, description, plugin }] : [];
        });
        const result = await generateDescription(ctx, value, { schemas, signal: controller.signal });
        // Generation is only a draft. It never saves config or emits system-prompt/change.
        if (!res.destroyed) return respond(res, 200, result);
      } catch (error) {
        const safe = error instanceof DiscoveryError ? error : new DiscoveryError('简介生成失败，请稍后重试', 502);
        if (!res.destroyed) respond(res, safe.status, { error: { message: safe.message } });
      } finally {
        clearTimeout(timer);
        req.off('aborted', disconnected);
        res.off('close', disconnected);
        if (controller) generating = false;
      }
    }
    routeCtx.effect(() => routeCtx.webServer.register({ kind: 'exact', path: API, handler }), 'tool-discovery:api');
    routeCtx.effect(() => routeCtx.webServer.register({ kind: 'exact', path: API + '/generate', handler: generationHandler }), 'tool-discovery:generate-api');
  });
}
