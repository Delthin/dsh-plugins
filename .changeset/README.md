# Changesets

Run `npm run changeset` after a package change. Select only affected packages. Packages have independent versions; this repository has no combined installable plugin.

Version updates are prepared with `npm run version:packages`. This does not publish packages. First publication, npm ownership, licenses, and OIDC authorization require separate confirmation.

由于 npm 默认 semver 规则会将不同版本元组（tuple）的预发布版本排除在常规 `>=` 范围之外，最低要求为 `>=0.2.1-rc.5` 的包与 DSH `engines.dsh` 宿主范围显式声明为 `>=0.2.1-rc.5 || >=0.2.2-rc.1`；最低要求原本即为 `>=0.2.2-rc.1` 的条目则维持原范围。该配置用于确保当前 RC 与正式新版本均可正常解析，并非承诺兼容未来所有 RC 或 API 变更。
