# WSL 管理

CogniaLauncher 提供完整的 Windows Subsystem for Linux (WSL) 管理功能。

!!! note "仅限 Windows"
    此功能仅在 Windows 平台上可用。

---

## 功能概述

### 能力探测与自动降级

- 启动 WSL 页面后，应用会读取 `wsl --help` 与 `wsl --version`，自动探测当前机器支持的命令能力。
- 对于新命令（如 `--manage --move` / `--manage --resize` / `--set-default-user`），界面会按能力自动启用或置灰，并提示原因。
- 默认用户设置优先使用 `wsl --manage <distro> --set-default-user`；若当前环境不支持，会自动回退到旧兼容路径。
- 运行中发行版检测优先使用 `wsl --list --running --quiet`，避免多语言输出误判。

### 版本要求（关键能力）

- `wsl --manage` 系列能力建议使用 **Microsoft Store 版 WSL 2.5+**（`move`/`resize`/`set-default-user` 等命令以本机 `wsl --help` 为准）。
- `--set-sparse` 需要较新的 Store 版 WSL（微软在 2024 年已公开该能力）。
- 如本机命令面未提供某参数，CogniaLauncher 会自动降级并提示。

### 发行版管理

- **列出已安装** — 查看所有 WSL 发行版及其状态
- **在线搜索** — 浏览可安装的发行版
- **安装** — 一键安装新发行版
- **安装到指定位置** — 将选定发行版安装到用户指定的主机目录
- **卸载** — 注销并删除发行版
- **设为默认** — 设置默认发行版

### 版本管理

- **WSL 版本切换** — 在 WSL 1 和 WSL 2 之间切换
- **默认版本设置** — 设置新发行版的默认 WSL 版本

### 导入导出

- **能力门控格式** — 仅在运行时能力探测支持时显示 VHD 导出/导入控件
- **导出** — 确定性导出路径处理（`.tar` 或 `.vhdx`），并提供可执行错误提示
- **导入** — 从 tar/vhdx 文件导入发行版（VHD 模式遵循运行时能力门控）
- **就地导入** — 使用 VHD 格式导入

### 运行管理

- **启动** — 启动指定发行版
- **终止** — 终止指定发行版
- **关闭 WSL** — 关闭所有运行中的发行版
- **查看运行中** — 列出当前运行的发行版
- **在资源管理器打开** — 在 Windows 资源管理器中打开发行版文件系统
- **在终端打开** — 直接在 Windows Terminal（或回退 Shell）中打开发行版
- **内联生命周期反馈** — 长任务、批量操作和高风险操作会在页面内保留运行/成功/失败状态与重试提示
- **工作流续接** — 进入发行版详情时会保留返回原始概览、侧边栏或卡片入口的路径

### 磁盘管理

- **挂载磁盘** — 将物理磁盘挂载到 WSL
- **卸载磁盘** — 从 WSL 卸载磁盘
- **磁盘使用** — 查看发行版的磁盘占用
- **总磁盘占用** — 查看所有已安装发行版的汇总占用
- **迁移发行版** — 使用 `wsl --manage <distro> --move <location>`
- **扩容虚拟磁盘** — 使用 `wsl --manage <distro> --resize <size>`
- **Sparse 模式** — 开启/关闭 VHD 自动回收
- **克隆发行版** — 通过导出/导入流程复制现有发行版
- **批量启动 / 终止** — 支持多发行版运行操作，并提供逐发行版结果摘要与失效选择自动清理

### 网络与用户

- **获取 IP** — 查看发行版的 IP 地址
- **更改默认用户** — 修改发行版的默认登录用户
- **健康检查** — 在发行版详情中运行健康诊断并查看结构化问题/时间戳
- **端口转发** — 以显式二次确认和风险提示执行 `netsh portproxy` 规则增删

### 辅助设施

- **运行时辅助区** — 在 WSL 主流程中提供按“检查 / 修复 / 维护”分组的引导动作。
- **发行版辅助区** — 在发行版详情流程中提供带上下文预填的辅助动作。
- **预检能力** — 运行时与发行版预检都会返回结构化检查项与可执行建议。
- **上下文恢复建议** — 错误面板可内联推荐相关辅助动作并在当前上下文直接触发。
- **结构化诊断摘要** — 辅助动作输出状态、时间戳、发现项、建议与重试入口。
- **变更后状态对齐** — 辅助触发的变更会刷新受影响状态切片，避免 UI 展示陈旧数据。
- **回链保留** — 辅助与发行版详情工作流会保留返回原始 WSL 入口的清晰路径

### 发行版配置

通过 `/etc/wsl.conf` 管理每个发行版的配置：

- **systemd** — 启用/禁用 systemd
- **自动挂载** — Windows 驱动器自动挂载
- **互操作** — Windows/Linux 程序互操作
- **自定义键值** — 编辑任意配置项

### WSL 更新

- 检查 WSL 组件更新
- 执行 WSL 更新

### 高风险操作防护

以下操作在 UI 中均会弹出二次确认，并给出管理员权限/风险提示：

- 注销发行版（`unregister`）
- 迁移与扩容（`move` / `resize`）
- 挂载与卸载磁盘（`mount` / `unmount`）
- 关闭所有实例（`shutdown`）
- 端口转发规则增删（`add/remove portproxy`）

---

## 相关命令

| 命令 | 描述 |
|------|------|
| `wsl_list_distros` | 列出已安装的发行版 |
| `wsl_list_online` | 列出可安装的发行版 |
| `wsl_status` | WSL 状态信息 |
| `wsl_terminate` | 终止发行版 |
| `wsl_shutdown` | 关闭 WSL |
| `wsl_set_default` | 设置默认发行版 |
| `wsl_set_version` | 设置发行版 WSL 版本 |
| `wsl_export` | 导出发行版 |
| `wsl_import` | 导入发行版 |
| `wsl_import_in_place` | 就地导入 |
| `wsl_install_with_location` | 按自定义位置安装发行版 |
| `wsl_update` | 更新 WSL |
| `wsl_launch` | 启动发行版 |
| `wsl_open_in_explorer` | 在资源管理器中打开发行版文件系统 |
| `wsl_open_in_terminal` | 在终端中打开发行版 |
| `wsl_clone_distro` | 克隆发行版 |
| `wsl_mount` | 挂载磁盘 |
| `wsl_unmount` | 卸载磁盘 |
| `wsl_get_ip` | 获取 IP 地址 |
| `wsl_change_default_user` | 更改默认用户 |
| `wsl_get_distro_config` | 读取发行版配置 |
| `wsl_set_distro_config` | 写入发行版配置 |
| `wsl_get_capabilities` | 获取运行时命令能力 |
| `wsl_get_version_info` | 获取 WSL 组件详细版本信息 |
| `wsl_total_disk_usage` | 获取所有发行版总磁盘占用 |
| `wsl_move_distro` | 迁移发行版磁盘位置 |
| `wsl_resize_distro` | 扩容发行版虚拟磁盘 |
