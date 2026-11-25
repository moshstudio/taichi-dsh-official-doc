# taichi-dsh-official-doc

DSH Desktop 的公文插件。它从插件市场手动安装，不随桌面内置。

安装并激活后，活动栏出现「公文」。页面内包含工作台、文档处理、Markdown 优化、校审中心、模板中心和关于。

格式检查和 docx 修复由插件完成。文字润色和模板配图使用太极当前会话，不在插件里配置模型供应商。第一版只接收 `.docx`。

```bash
npm install
npm test
```

发布前用 `npm pack --dry-run` 确认包内包含 `cordis.patch.yml`、`dsh/`、`lib/`、`rules/` 和 `templates/`，且不超过 8 MiB。

市场上架需另向 `awesome-dsh-plugin` 提交收录条目。收录合并不代表桌面市场已经可见。