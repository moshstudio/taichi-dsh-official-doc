# 商用化重构续作记录

更新时间：2026-11-25

本文用于在新会话中恢复工作上下文。当前分支的未提交改动属于进行中的重构，不要清理或覆盖。

## 当前状态

- [x] 工程底座（阶段 1）：配置 `tsdown` / TypeScript，客户端构建仍走 DSH `window.__ModuleLoader__` 包装，服务端产物为 `dsh/index.mjs`；peer 依赖已移除未使用的 renderer。
- [x] OOXML 补丁层核心（阶段 2）：`dsh/zip.js` 从 ZIP 中央目录读取，处理 data descriptor、store/deflate 与 CRC；`dsh/docx.js` 读取段落、表格和页面尺寸，并可只替换 `word/document.xml`，其他条目内容保留；原始 docx 单独存为 job `.docx` 文件，JSON job 不承载大块 base64。
- [x] 规则与角色识别（阶段 3）：`dsh/roles.js` 同时服务 docx 读取和 Markdown 解析。四级标题、发文字号、签发人、附件、抄送、版记可识别。`_common.yaml` 按级配置标题字体，`applyFixes` 只改已勾选项。`yaml` 正式解析。22 文种规则回归已覆盖。
- [x] 作业保留与上传校验（阶段 4）：`saveJobBundle` 先写临时文件再一起改名；改名失败会清掉已提交文件和临时文件。上传超过 8 MiB 在读 docx 前拒绝。路由表未改。
- [x] 客户端拆分（阶段 5）：入口仍是 `src/client/index.tsx`。壳层、文案样式、请求、提示词、预览、页面各自成模块。活动栏按钮和 `getSnapshot` 缓存引用未改。旧 `lib/client-logic.js` 与字符串拼接构建脚本已删除。
- [x] AI 会话闭环（阶段 6）：润色、去 AI 味、深度分析、模板起草通过 `draftToSession` 写入太极当前会话草稿。已有不同草稿时不覆盖。Markdown 页可从最近助手回复取回结果。插件不配置模型，也不代发。
- [x] 账号积分（阶段 7）：本地账号初始 20 分，存在数据目录 `account.json`。润色、去 AI 味各 1 分，深度分析、模板起草各 2 分。先扣再写会话；写入失败退回。余额不足拒绝。格式检查不扣分。关于页显示余额。
- [x] 发布前结构验证：页码、红头、版记已写入 docx，并可再次读取正文。包体 65.5 kB，含 `cordis.patch.yml`、`dsh/`、`lib/`、`rules/`、`templates/`。30 项测试通过。
- [ ] 真实 Word/WPS 样本仍未覆盖。仓库内没有公文样本；相邻仓库的 example.docx 是研报和会议稿，且有一份超过 8 MiB 上传限制。复杂 run、超链接、合并单元格、ZIP64 不能据此放行。

## 当前验证

最后一次运行：

- `npm test`：30/30 通过。
- `npm pack --dry-run`：65.5 kB，55 个文件。
- `npm run typecheck`：通过。
- `npm run build`：通过。服务端产物 `dsh/index.mjs`，客户端产物 `lib/client.js`。

## 首要续作步骤

1. 拿到真实公文 `.docx` 后再测复杂 run、超链接、图片、页眉页脚、多个 section、编号和合并单元格。当前合成样例不能代替。
2. 页码、红头、版记只在新建文档时写入。对已有 docx 的局部补丁仍只改段落文字、字体、字号、对齐和缩进。

## OOXML 实现边界与待验证风险

- OOXML/XML 解析仍是轻量正则实现，不是通用 XML AST；当前保真测试是合成样例，不含真实 Word/WPS 样本。商业发布前应补真实 `.docx` 样本（包含复杂 run、超链接、图片、页眉页脚、多个 section、编号、合并单元格）。
- ZIP 写回会保留未修改条目的**解压内容**，但当前会重新压缩整个 ZIP；没有逐条复制原始压缩字节，也未验证 ZIP64、加密条目或超大条目。不能宣称压缩包字节级不变。
- 表格模型目前只区分首行 `headers` 与后续 `rows`，嵌套表格、合并单元格和复杂单元格结构尚不支持。
- 格式补丁只覆盖已实现的段落文字、字体、字号、对齐、缩进；页码、红头、版记等 Patch DSL 操作尚未接通。
- `readDocx` 的内部映射元数据需由服务端保留用于 patch，不应泄漏到 API preview DTO。
- 原件以 `data/jobs/<id>.docx` 保存，JSON 位于相邻 job 文件；原子写和源文件/模型的跨文件一致性还需补事务式 staging/rename 测试。

## 重要文件

- `dsh/docx.js`：文档读取、解析、局部 XML patch 和新文档生成。
- `dsh/zip.js`：ZIP 中央目录读取、CRC 校验与 ZIP 重建。
- `dsh/rules.js`：规则解析、检查、修复、Markdown 模型生成。
- `dsh/store.js`：规则/模板/历史/job JSON 和原始 docx 文件存储。
- `dsh/index.js`：Cordis 服务端路由与 check/fix/redact 流程。
- `src/server/rules/engine.ts`：规则 patch DSL 原型，当前未成为正式服务端入口。
- `src/client/plugin.js`：活动栏、页面壳和 `getSnapshot`。
- `src/client/views.js`、`src/client/pages.js`：工作台、文档处理、校审、Markdown、模板、关于。
- `tsdown.config.ts`、`tsconfig.json`：双产物构建与客户端类型检查配置。
- `test/docx-patch.test.mjs`：OOXML/ZIP 合成夹具。
- `test/build.test.mjs`：ModuleLoader 和 package manifest 契约测试。

## 新会话提示

先读取本文。阶段 1 到 7 已完成。不要重置或覆盖现有工作区改动。继续前先跑全量测试和构建。