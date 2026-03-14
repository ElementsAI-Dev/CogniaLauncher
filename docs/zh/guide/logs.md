# 日志系统

CogniaLauncher 的日志体系分为三层：后端结构化日志、前端运行时日志、崩溃诊断包。

---

## 日志来源

### 后端日志（按构建 profile 区分）

- **Release 构建** 使用 `tauri-plugin-log` 输出标准输出、WebView 转发和持久化会话日志文件。
- **桌面 debug 构建** 使用 CrabNebula DevTools instrumentation，而不会同时启用 `tauri-plugin-log`，因为两者的 logger 集成会冲突。
- 如果你在 `pnpm tauri dev` 期间需要查看后端日志流、事件或命令链路，请直接在 CrabNebula DevTools 中连接应用。

### 前端日志（LogProvider）

- 控制台拦截：`console.*` 写入前端日志 store
- 事件日志：下载、批量操作、自更新、更新检查等统一进入日志面板
- 运行时异常：监听 `window.error` 与 `window.unhandledrejection`
- 当桌面 debug 构建无法连接后端 `plugin-log` bridge 时，LogProvider 会继续保留前端/事件日志，并给出指向 CrabNebula DevTools 的开发提示。

## Debug 与 Release 的日志工作流

- 在开发阶段需要实时后端诊断时，使用 `pnpm tauri dev` 配合 CrabNebula DevTools。
- 在启用 `tauri-plugin-log` 的 release 风格构建中，使用应用内 `/logs` 页面查看持久化会话日志和历史导出。
- 桌面 debug 构建中 Rust 后端日志不再流入应用内日志面板属于预期行为。

### 崩溃诊断包

- Rust panic：通过 panic hook 自动生成 ZIP
- 前端未捕获异常（仅桌面模式）：自动调用 `diagnostic_capture_frontend_crash`
- 每个会话最多自动上报 1 次，避免刷屏
- 生成后保留最近 20 份，旧诊断包会自动清理

---

## 日志格式兼容

日志查询与导出支持同时解析以下两种历史格式：

1. 新格式  
   `[YYYY-MM-DD HH:MM:SS(.ms)][LEVEL][TARGET] MESSAGE`
2. 旧格式  
   `[YYYY-MM-DD][HH:MM:SS][TARGET][LEVEL] MESSAGE`

说明：

- 旧格式会自动合并 `date + time` 为完整时间戳，确保 `start_time` / `end_time` 过滤准确。
- 非结构化行会走 fallback，不会因解析失败而丢失日志。

---

## 查询与导出行为

- `log_query` 与 `log_export` 均支持普通 `.log` 与压缩 `.log.gz` 文件。
- `log_query` 使用基于尾部窗口的分页（结合 `offset` / `limit` 查看最近日志），可降低大文件内存占用。
- 启用过滤条件时可传入 `max_scan_lines` 限制扫描深度，适合日志跟随/轮询场景。
- `log_export` 在同一套格式兼容能力下支持 TXT/JSON 过滤导出。

---

## 崩溃恢复体验

- 自动诊断成功后，本次会话显示轻量提示（toast）。
- 同时写入 crash marker；下次启动会弹出恢复对话框，支持打开报告目录或忽略提示。

---

## 相关命令

| 命令 | 描述 |
|------|------|
| `log_query` | 查询日志（级别/时间/关键词过滤 + 分页，支持 `max_scan_lines`） |
| `log_export` | 导出日志（TXT/JSON，支持 `.log` 与 `.log.gz`） |
| `log_list_files` | 列出日志文件 |
| `log_get_dir` | 获取日志目录 |
| `log_get_total_size` | 获取日志总大小 |
| `log_clear` | 清理日志文件 |
| `diagnostic_export_bundle` | 手动导出诊断包 |
| `diagnostic_capture_frontend_crash` | 前端异常自动诊断包命令 |
