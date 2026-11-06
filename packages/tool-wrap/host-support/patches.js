// Audited local adaptation, deliberately independent of the plugin's open host range.
export const HOST_VERSION = '0.2.2-rc.1';
export const PATCHES = [
  {
    name: '@deepseek-ai/dsh-system-prompt',
    sha256: '18b692b03bbb717589085f63b126cbcf22963763c5a0565bb3a7a5d254e8e4a7',
    edits: [
      ['function resolveContext(entry, context) {', 'function resolveContext(entry, context, composition) {'],
      ['\t\tname: entry.name,\n\t\ttext:', '\t\tname: entry.name,\n\t\tcompositionSource: composition?.registrationMetadata(entry, "context", context.scope),\n\t\ttext:'],
      ['resolveContext(provider, context)', 'resolveContext(provider, context, this.ctx.get("toolWrapPromptComposition"))', 2],
      ['resolveContext(entry, context)', 'resolveContext(entry, context, this.ctx.get("toolWrapPromptComposition"))'],
      ['\t\t\t\tname: section.name,\n\t\t\t\ttext:', '\t\t\t\tname: section.name,\n\t\t\t\tcompositionSource: this.ctx.get("toolWrapPromptComposition")?.registrationMetadata(section, "section", scope),\n\t\t\t\ttext:'],
      ['\tsection(section) {', '\t// Local tool-wrap admission adapter v1; not an upstream public API.\n\tget promptCompositionVersion() { return globalThis[Symbol.for("dsh.tool-wrap.admission.v1")] === true && globalThis[Symbol.for("dsh.tool-wrap.instructions.v1")] === true && globalThis[Symbol.for("dsh.tool-wrap.session.v1")] === true ? 1 : 0; }\n\tasync admitContributions(input) {\n\t\tif (this.promptCompositionVersion !== 1) return undefined;\n\t\treturn this.ctx.get("toolWrapPromptComposition")?.admit(input);\n\t}\n\tsection(section) {'],
    ],
  },
  {
    name: '@deepseek-ai/dsh-agent-loop',
    sha256: 'a6fa8e0c7c90191caf5f4a3bb5c624a86e9845cf3c79d020b71420d0e20ae4c1',
    edits: [
      ['import ', 'import { commitPromptComposition, restorePromptComposition, hasPromptComposition, validatePromptComposition } from "./tool-wrap-admission.js";\nglobalThis[Symbol.for("dsh.tool-wrap.admission.v1")] = true;\nimport ', 1, true],
      ['\t\t\tconst sections = renderContextSections(this.loopCtx.systemPrompt.refreshContext(assembly, {\n\t\t\t\t...assembleContextFor(this, signal),\n\t\t\t\tmodelSelection: decision.selection\n\t\t\t}));', '\t\t\tconst admissionAssembly = this.loopCtx.systemPrompt.refreshContext(assembly, {\n\t\t\t\t...assembleContextFor(this, signal),\n\t\t\t\tmodelSelection: decision.selection\n\t\t\t});\n\t\t\tconst sections = renderContextSections(admissionAssembly);\n\t\t\tconst composition = await this.loopCtx.systemPrompt.admitContributions({\n\t\t\t\tagent: this, assembly: admissionAssembly, messages: decision.messages,\n\t\t\t\ttoolSet: decision.toolSet, modelSelection: decision.selection, signal\n\t\t\t});'],
      ['\n\t\t\tconst context = this.runtimeContext.project(joinContextSections(sections), sections);', '\n\t\t\tif (composition !== undefined) validatePromptComposition(composition);\n\t\t\tconst context = this.runtimeContext.project(joinContextSections(sections), sections);'],
      ['this.systemPrompt.project(renderedPrompt, {', 'this.systemPrompt.project(composition?.systemText ?? renderedPrompt, {'],
      ['inHistory: preparedCall?.systemPromptUpdate === "in-history",', 'inHistory: composition === undefined && !hasPromptComposition(this.session) && preparedCall?.systemPromptUpdate === "in-history",'],
      ['\t\t\tlet contextAdmitted = false;\n\t\t\tif (firstAttempt)', '\t\t\tif (composition !== undefined) commitPromptComposition(this.session, composition, decision.messages, firstAttempt);\n\t\t\telse {\n\t\t\t\trestorePromptComposition(this.session);\n\t\t\tlet contextAdmitted = false;\n\t\t\tif (firstAttempt)'],
      ['\t\t\tfirstAttempt = false;\n\t\t\tconst request =', '\t\t\t}\n\t\t\tfirstAttempt = false;\n\t\t\tconst request ='],
    ],
  },
  {
    name: '@deepseek-ai/dsh-agent-instructions',
    sha256: 'afbd526d1e3126a368774f24105140adc3ef532ca4aa93cfa0fb1318d5b9b75d',
    edits: [
      ['import ', 'globalThis[Symbol.for("dsh.tool-wrap.instructions.v1")] = true;\nimport ', 1, true],
      ['renderInstructionChains(items.map((item) => item.file), maxBytes, {', 'renderInstructionChains(items.map((item) => ({ ...item.file, compositionAction: item.change.action })), maxBytes, {'],
      ['absolutePath: `removed:${scope}`,', 'absolutePath: scopeInstructionFile(scope, projectRoot, resolved).absolutePath,'],
      ['function renderAgentInstructionSet(files, options) {', `function compositionBlocks(rendered, style, maxBytes) {
  const blocks = rendered.sections.map((file, index) => ({
    key: file.absolutePath,
    path: file.displayPath,
    action: file.compositionAction ?? "set",
    scope: isUserGlobalInstruction(file) ? "global" : "project",
    text: buildInstructionText([file], maxBytes, index === 0 ? rendered.omitted : [], rendered.truncated.filter(item => item.displayPath === file.displayPath), style)
  }));
  if (!blocks.length && rendered.text) blocks.push({ key: "budget:" + instructionContentSha1(JSON.stringify(rendered.omitted.map(file => file.absolutePath))), path: "@instruction-budget", action: "set", scope: "project", text: rendered.text });
  return blocks;
}
function renderAgentInstructionSet(files, options) {`],
      ['const { text, omitted, truncated, represented } = renderInstructionChains(files, options.maxBytes, style);', 'const details = renderInstructionChains(files, options.maxBytes, style);\n\tconst { text, omitted, truncated, represented } = details;'],
      ['\t\t\ttext,\n\t\t\tomitted,\n\t\t\ttruncated\n\t\t},\n\t\tincluded: represented', '\t\t\ttext,\n\t\t\tomitted,\n\t\t\ttruncated,\n\t\t\tcompositionSections: compositionBlocks(details, style, options.maxBytes)\n\t\t},\n\t\tincluded: represented'],
      ['\t\ttext: rendered.text,\n\t\tchanges: items.filter', '\t\ttext: rendered.text,\n\t\tcompositionSections: compositionBlocks(rendered, { intro: "", section(file) { const item = byAbsolutePath.get(file.absolutePath); return changedSectionText({ ...item, file }); } }, maxBytes),\n\t\tchanges: items.filter'],
      ['function agentInstructionsHook(text, changes) {', 'function agentInstructionsHook(text, changes, compositionSections = []) {'],
      ['\t\t\tform: "instructions",\n\t\t\tchanges\n', '\t\t\tform: "instructions",\n\t\t\tcompositionSections,\n\t\t\tchanges\n'],
      ['agentInstructionsHook(rendered.text, rendered.changes)', 'agentInstructionsHook(rendered.text, rendered.changes, rendered.compositionSections)'],
      ['\t\tconst content = [];\n\t\tconst changes = [];', '\t\tconst content = [];\n\t\tconst changes = [];\n\t\tconst compositionSections = [];'],
      ['const keepVisibleBaseline = visibleBaseline?.baselineIdentity === identity;', 'const keepVisibleBaseline = visibleBaseline?.baselineIdentity === identity && (!ctx.get("toolWrapPromptComposition")?.enabled || Array.isArray(visibleBaseline.compositionSections));'],
      ['\t\t\t\tcontent.push(...baselineContent);', '\t\t\t\tcontent.push(...baselineContent);\n\t\t\t\tcompositionSections.push(...instructions.rendered.compositionSections);'],
      ['\t\t\tcontent.push(...update.context.content);', '\t\t\tcontent.push(...update.context.content);\n\t\t\tcompositionSections.push(...(update.context.source.compositionSections ?? []));'],
      ['\t\t\t\t...desiredBaseline ? { baselineIdentity: identity } : {},\n\t\t\t\tchanges', '\t\t\t\t...desiredBaseline ? { baselineIdentity: identity } : {},\n\t\t\t\tcompositionSections,\n\t\t\t\tchanges'],
    ],
  },
  {
    name: '@deepseek-ai/dsh-session',
    sha256: '6fad466aa1f7aa64bfa038681ead5721f66c88e9891e25d357d2b8edbccd5494',
    edits: [
      ['import ', 'globalThis[Symbol.for("dsh.tool-wrap.session.v1")] = true;\nimport ', 1, true],
      ['case "user/message": return event.data;', 'case "user/message": return event.data.content.length === 0 && (event.data.source.kind === "prompt-composition-cleared" || event.data.source.kind === "prompt-composition-state" || event.data.source.kind !== "user" && event.data.source.compositionAuthority === true) ? null : event.data;'],
    ],
  },
  {
    name: '@deepseek-ai/dsh-session', file: 'lib/types/surface.js',
    sha256: 'ebe8920a22fca8d987cbacab94c9db92f71df44863f58370a1be559155be734e',
    edits: [
      ["case 'user/message': {\n            return event.data;", "case 'user/message': {\n            if (event.data.content.length === 0 && (event.data.source.kind === 'prompt-composition-cleared' || event.data.source.kind === 'prompt-composition-state' || event.data.source.kind !== 'user' && event.data.source.compositionAuthority === true)) return null;\n            return event.data;"],
    ],
  },
];

export function patchSource(source, patch) {
  let output = source;
  for (const [before, after, expected = 1, firstOnly = false] of patch.edits) {
    const count = output.split(before).length - 1;
    if (firstOnly ? !output.startsWith(before) : count !== expected) throw new Error(`${patch.name}: unsupported patch anchor (${count}, expected ${expected})`);
    output = firstOnly ? output.replace(before, after) : output.split(before).join(after);
  }
  return output;
}
