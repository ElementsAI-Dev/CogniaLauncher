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

### `/logs` 可观测性工作台

- `/logs` 页面现在是桌面端排障的主工作台。
- 它把实时日志、历史文件查看、清理控制、后端 bridge 指引、完整诊断导出和最近崩溃报告浏览收敛到同一入口。
- 在桌面 debug 模式下，页面会持久提示你改用 CrabNebula DevTools 来检查后端命令、事件和日志。
- 在桌面 release 模式下，页面会明确说明当前应能直接在应用内查看持久化会话日志与历史日志文件。
- 在 web 模式下，页面仍可显示前端内存日志，但会明确标注后端日志文件与完整诊断包不可用。

### 崩溃诊断包

- Rust panic：通过 panic hook 自动生成 ZIP
- 前端未捕获异常（仅桌面模式）：自动调用 `diagnostic_capture_frontend_crash`
- 每个会话最多自动上报 1 次，避免刷屏
- 生成后保留最近 20 份，旧诊断包会自动清理
- `/logs` 会展示最近崩溃报告的来源、时间、路径以及待处理状态，方便与启动恢复提示进行对应

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

### 过滤日志导出 与 完整诊断包 的区别

- 工具栏里的 `TXT`、`JSON`、`CSV` 导出属于过滤日志导出，只会包含当前选中的日志流或历史查询窗口。
- `/logs` 页面中的“完整诊断包”动作会通过 `diagnostic_export_bundle` 生成支持包，内容范围比当前日志行更广。
- 当你从 `/logs` 触发完整诊断导出时，诊断包还会记录运行模式、bridge 状态、选中文件和当前筛选条件等上下文。

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
| `diagnostic_list_crash_reports` | 列出供日志工作台使用的最近崩溃报告 |
| `diagnostic_capture_frontend_crash` | 前端异常自动诊断包命令 |
