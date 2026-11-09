# Prompt composition host adapter

This directory is an explicit, reversible local host adaptation, not a public DSH API and not an npm lifecycle action. The plugin supports hosts at or above its declared minimum; this adapter only accepts the exact audited 0.2.2-rc.1 file shape. The Lead must review and explicitly apply it. It never restarts a process.

## UI/backend contract

`GET/PUT /api/tool-discovery/prompt-composition` returns `{config,sources,capabilities}`. Configuration is independently stored in `prompt-composition.json`: `{version:1,enabled:false,order:[],rules:{}}`. A rule is `{role:'inherit'|'system'|'developer'|'user',delivery:'inherit'|'always'|'pack'}`. PUT validates capabilities and source identity before persisting; unsupported choices fail, rather than pretending to save.

Stable contribution IDs are `section:<encoded owner>:<encoded registration name>`, `context:<encoded owner>:<encoded registration name>`, and `instructions:<encoded real-file key>` (the source's absolute file identity; the display path is only its label). AGENTS grouping IDs are `instructions:global` and `instructions:project`; file rules override their group. Source metadata contains `id,label,owner,kind,defaultRole,roles,deliveryModes,reason,children?`. Registry ownership comes from the actual Cordis registration context, never a prompt-name prefix. Unattributed final-assembly contributions remain visible, orderable and configurable as system/user; they cannot follow a guessed plugin's pack. Trusted pre-step messages use native ContextFormed instructions/catalog/snapshot metadata and IDs `message:<encoded source.kind>:<form>:<encoded source.name>`, grouped by `message-source:<encoded source.kind>`. Ordinary user messages and generic notice/relay/recall data are excluded. An explicit compatibility adapter recognizes the audited dsh-mnemon createPluginMessage envelopes: instructions remain guidance and recall is its runtime-memory snapshot. That snapshot stays present by default unless explicitly deferred; other recalled material is not treated as instructions.

The unwrap directory is a separate `tool-discovery:directory` section owned by `@delthin/dsh-tool-wrap`, always available when deferred packs exist. It cannot defer itself.

### Safe registration previews

Global registered section/context sources include `source.preview`:

- `{kind:'static',text:string}` contains the complete, unchanged registration literal, including empty strings and unresolved `{{variable}}` references. It is not the final rendered session prompt.
- `{kind:'dynamic',reason:'session-context-required',message:string}` means the registered `text` is a provider requiring session context. The message explains why no body is available; `text` is omitted.
- `{kind:'unavailable',reason:'static-text-unavailable',message:string}` means no safe own data-property string/provider was found (for example, an accessor or unsupported definition). `text` is omitted.

The audited SystemPrompt contract uses `text: string | ((context: AssembleContext) => string)` for both sections and contexts; contexts have no separate `render` field. Preview generation reads only global registration data properties. It never assembles a prompt, invokes providers/accessors/variables, interpolates text or serializes function source. The existing authenticated GET/status response passes these previews through independently of host-adapter availability. Clients can show `preview.text` for static sources and `preview.message` for dynamic/unavailable sources.

Scoped registrations and observed assembly/message/AGENTS bodies are excluded. Observed sources retain identity metadata only and do not acquire previews from session content; groups and unavailable stored IDs also have no registration preview. A scoped shadow or the most recent session cannot replace a global registration preview. Dynamic/session-only content would require a separately authorized caller-scoped preview API; it must not be cached into global status.

## Admission boundary

The host hook executes after complete-persona enforcement, runtime-context refresh and pre-step hooks, but before any contributed message is admitted to the session surface. It is not a request/stream rewrite. Ordinary conversation messages are never supplied as configurable instruction contributions. The unmodified path remains byte/order/role compatible when composition is disabled.

The host records original instruction messages as audit events and retains source-authority metadata on the surface; composed snapshots use ordinary system/user message events; developer is not currently supported. Snapshot replacement uses logged surface operations, allowing request reconstruction solely from the session log. AGENTS rendering attaches exact per-file blocks during budget rendering; admission does not split or infer boundaries from prose.

Pack delivery requires an identified plugin and a caller-visible deferred tool in that plugin. Guidance comes from the calling scope/toolSet’s accepted step, without re-evaluating dynamic providers or sharing bodies between conversations. A successful visible root-call result activates that pack for this session; subsequent admissions place its guidance in the configured real system/user role. The small activation event stores only plugin/root-call identity. Activation is reconstructed against visible successful results, so replay preserves it and rewinding/removing the result cancels it. Schema definitions remain tool results, not elevated instructions. Changing roles/order or activating guidance can change the system text and its cache prefix; the adapter does not claim cache-hit equivalence. Required contexts are refreshed before composition, so delivery is not undone by host refresh. Tool admission, guard, approval, sandbox and native transport behavior remain owned by the existing host.

## Review and application

The adapter script supports `--check`, `--apply` and `--restore`, with an explicit installation root. It verifies package versions, exact source hashes and all patch anchors before touching files. Backups and a manifest permit restoration only when the installed patched hash still matches. It does not change package version ranges or touch runtime profiles. Never apply automatically during installation or synchronization.
