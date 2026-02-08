# 日志系统

CogniaLauncher 提供完整的日志记录和查看功能。

---

## 日志来源

### 后端日志

使用 `tauri-plugin-log` 记录：

- **输出目标**：标准输出、WebView、日志文件
- **日志轮转**：保留 5 个文件，每个最大 10MB
- **日志级别**：Error、Warn、Info、Debug、Trace

### 前端日志

通过 `LogProvider` 组件拦截浏览器控制台输出：

- `console.log` → Info
- `console.warn` → Warn
- `console.error` → Error
- `console.debug` → Debug

### 事件日志

自动记录关键事件：

- 下载任务状态变化（添加、开始、完成、失败等）
- 自更新进度
- 更新检查进度

---

## 日志查看

### 实时日志

日志页面的 **实时** 标签页：

- 实时滚动显示新日志
- 按级别过滤（Error/Warn/Info/Debug）
- 按关键词搜索
- 分页浏览

### 日志文件

日志页面的 **文件** 标签页：

- 查看历史日志文件
- 日志文件总大小统计
- 文件内容搜索

---

## 日志格式

后端日志格式：

```
[TIMESTAMP][LEVEL][TARGET] MESSAGE
```

示例：

```
[2026-02-05 10:30:00][INFO][cognia_launcher::commands::environment] Installing Node.js v20.11.0
```

---

## 日志面板

除了专用的日志页面，还可以通过日志抽屉（LogDrawer）在任何页面查看最近的日志。

---

## 状态管理

日志数据存储在 `lib/stores/log.ts`（Zustand）：

- 日志条目列表
- 过滤条件
- 分页状态
- 持久化偏好

---

## 相关命令

| 命令 | 描述 |
|------|------|
| `log_get_entries` | 获取日志条目 |
| `log_clear` | 清空日志 |
| `log_get_total_size` | 获取日志文件总大小 |
