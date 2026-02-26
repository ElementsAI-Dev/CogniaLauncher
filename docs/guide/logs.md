# 日志系统

CogniaLauncher 的日志体系分为三层：后端结构化日志、前端运行时日志、崩溃诊断包。

---

## 日志来源

### 后端日志（Tauri + `tauri-plugin-log`）

- 输出目标：标准输出、WebView、日志文件
- 日志轮转：最多 5 个文件、单文件 10MB
- 日志级别：`ERROR` / `WARN` / `INFO` / `DEBUG` / `TRACE`

### 前端日志（LogProvider）

- 控制台拦截：`console.*` 写入前端日志 store
- 事件日志：下载、批量操作、自更新、更新检查等统一进入日志面板
- 运行时异常：监听 `window.error` 与 `window.unhandledrejection`

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

## 崩溃恢复体验

- 自动诊断成功后，本次会话显示轻量提示（toast）。
- 同时写入 crash marker；下次启动会弹出恢复对话框，支持打开报告目录或忽略提示。

---

## 相关命令

| 命令 | 描述 |
|------|------|
| `log_query` | 查询日志（级别/时间/关键词过滤 + 分页） |
| `log_export` | 导出日志（TXT/JSON） |
| `log_list_files` | 列出日志文件 |
| `log_get_dir` | 获取日志目录 |
| `log_get_total_size` | 获取日志总大小 |
| `log_clear` | 清理日志文件 |
| `diagnostic_export_bundle` | 手动导出诊断包 |
| `diagnostic_capture_frontend_crash` | 前端异常自动诊断包命令 |
