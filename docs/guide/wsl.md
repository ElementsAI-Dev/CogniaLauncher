# WSL 管理

CogniaLauncher 提供完整的 Windows Subsystem for Linux (WSL) 管理功能。

!!! note "仅限 Windows"
    此功能仅在 Windows 平台上可用。

---

## 功能概述

### 发行版管理

- **列出已安装** — 查看所有 WSL 发行版及其状态
- **在线搜索** — 浏览可安装的发行版
- **安装** — 一键安装新发行版
- **卸载** — 注销并删除发行版
- **设为默认** — 设置默认发行版

### 版本管理

- **WSL 版本切换** — 在 WSL 1 和 WSL 2 之间切换
- **默认版本设置** — 设置新发行版的默认 WSL 版本

### 导入导出

- **导出** — 将发行版导出为 tar 文件
- **导入** — 从 tar 文件导入发行版
- **就地导入** — 使用 VHD 格式导入

### 运行管理

- **启动** — 启动指定发行版
- **终止** — 终止指定发行版
- **关闭 WSL** — 关闭所有运行中的发行版
- **查看运行中** — 列出当前运行的发行版

### 磁盘管理

- **挂载磁盘** — 将物理磁盘挂载到 WSL
- **卸载磁盘** — 从 WSL 卸载磁盘
- **磁盘使用** — 查看发行版的磁盘占用

### 网络与用户

- **获取 IP** — 查看发行版的 IP 地址
- **更改默认用户** — 修改发行版的默认登录用户

### 发行版配置

通过 `/etc/wsl.conf` 管理每个发行版的配置：

- **systemd** — 启用/禁用 systemd
- **自动挂载** — Windows 驱动器自动挂载
- **互操作** — Windows/Linux 程序互操作
- **自定义键值** — 编辑任意配置项

### WSL 更新

- 检查 WSL 组件更新
- 执行 WSL 更新

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
| `wsl_update` | 更新 WSL |
| `wsl_launch` | 启动发行版 |
| `wsl_mount` | 挂载磁盘 |
| `wsl_unmount` | 卸载磁盘 |
| `wsl_get_ip` | 获取 IP 地址 |
| `wsl_change_default_user` | 更改默认用户 |
| `wsl_get_distro_config` | 读取发行版配置 |
| `wsl_set_distro_config` | 写入发行版配置 |
