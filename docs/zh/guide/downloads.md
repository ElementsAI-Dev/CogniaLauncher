# 下载管理

CogniaLauncher 提供完整的下载管理系统，支持队列、限速、并发控制和历史记录。

---

## 功能特性

### 下载队列

- **添加下载** — 通过 URL 添加下载任务
- **队列管理** — 自动排队，按优先级执行
- **并发控制** — 限制同时下载的任务数（默认 4）
- **入口一致性** — 手动添加、批量导入、GitHub、GitLab 均走统一的 `download_add` 契约

### 高级请求控制

- 下载完成后自动解压
- 自定义解压目标目录
- 自动重命名避免重名冲突
- 解压后删除归档文件
- 分段下载（并行连接数）
- 下载后动作（`none`、`open_file`、`reveal_in_folder`）
- 标签元数据（界面中使用逗号分隔）

### 任务控制

| 操作 | 描述 |
|------|------|
| 暂停 | 暂停单个/全部下载 |
| 恢复 | 恢复暂停的下载 |
| 取消 | 取消单个/全部下载 |
| 重试 | 重试失败的下载（指数退避） |
| 删除 | 从列表中移除任务 |
| 任务级限速 | 在详情弹窗中为单个任务设置速度限制 |

### 批量操作

- `download_batch_pause` — 批量暂停选中的任务
- `download_batch_resume` — 批量恢复选中的任务
- `download_batch_cancel` — 批量取消选中的任务
- `download_batch_remove` — 批量移除选中的任务

### 限速

- 设置全局下载速度限制（KB/s）
- 实时调整，立即生效

### 缓存命中

如果要下载的文件已存在于缓存中（校验和匹配），系统会直接从缓存复制，跳过网络下载。

### 下载历史

- 记录所有已完成、失败、取消的下载
- 搜索历史记录
- 查看统计信息
- 清空全部历史
- 按保留窗口清理（清理早于 N 天的记录）

### 失败与进度体验

- 失败/取消状态会映射为统一错误分类：
  `selection_error`、`network_error`、`integrity_error`、`cache_error`、`cancelled`、`timeout`
- 详情视图根据任务可恢复性提供可操作的重试建议
- 列表与详情共享实时任务状态/进度，避免显示不同步

### 文件操作

- **打开文件** — 使用系统默认程序打开
- **显示文件** — 在文件管理器中定位
- **验证文件** — SHA256 校验和验证

### 磁盘空间

- 下载前检查可用磁盘空间
- 显示磁盘使用情况

---

## 进度事件

下载过程通过 Tauri 事件系统推送进度：

- `download-task-added` — 新任务已添加
- `download-task-started` — 开始下载
- `download-task-completed` — 下载完成
- `download-task-failed` — 下载失败
- `download-task-paused` — 已暂停
- `download-task-resumed` — 已恢复
- `download-task-cancelled` — 已取消
- `download-task-extracting` — 开始解压归档
- `download-task-extracted` — 归档解压完成

---

## 优雅关闭

应用关闭时自动执行：

- 取消所有活跃下载
- 清理过期的部分下载文件（超过 7 天）
- 保存下载状态

---

## 相关命令

| 命令 | 描述 |
|------|------|
| `download_add` | 添加下载任务 |
| `download_list` | 列出活跃下载 |
| `download_pause` / `resume` / `cancel` | 控制单个任务 |
| `download_pause_all` / `resume_all` / `cancel_all` | 控制全部任务 |
| `download_set_speed_limit` | 设置限速 |
| `download_set_task_speed_limit` | 设置指定任务限速 |
| `download_set_max_concurrent` | 设置最大并发 |
| `download_verify_file` | 验证文件校验和 |
| `download_open_file` | 打开文件 |
| `download_reveal_file` | 在文件管理器中显示 |
| `download_history_list` | 下载历史列表 |
| `download_history_search` | 搜索历史 |
| `download_history_clear` | 清空全部历史或清理早于 N 天的记录 |
| `download_history_stats` | 历史统计 |
| `download_shutdown` | 优雅关闭 |
| `disk_space_check` | 检查磁盘空间 |
