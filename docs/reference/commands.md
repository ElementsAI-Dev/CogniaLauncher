# Tauri 命令参考

CogniaLauncher 后端提供 217+ Tauri 命令，通过 IPC 供前端调用。

---

## 环境管理 (Environment)

| 命令 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `env_list` | - | `Vec<EnvInfo>` | 列出所有环境类型 |
| `env_get` | `env_type` | `EnvDetail` | 获取环境详情 |
| `env_install` | `env_type, version` | `InstallReceipt` | 安装运行时版本 |
| `env_uninstall` | `env_type, version` | `UninstallReceipt` | 卸载运行时版本 |
| `env_use_global` | `env_type, version` | - | 设置全局版本 |
| `env_use_local` | `env_type, version, dir` | - | 设置项目级版本 |
| `env_detect` | `env_type` | `Vec<DetectedVersion>` | 检测已安装版本 |
| `env_available_versions` | `env_type` | `Vec<String>` | 获取可用版本列表 |
| `env_resolve_alias` | `env_type, alias` | `String` | 解析版本别名 |
| `env_install_cancel` | `env_type` | - | 取消安装 |
| `env_get_modifications` | `env_type, version` | `Vec<EnvMod>` | 获取环境变量修改 |
| `env_provider_info` | `env_type` | `ProviderInfo` | Provider 信息 |

---

## 包管理 (Package)

| 命令 | 描述 |
|------|------|
| `package_search` | 搜索包 |
| `package_info` | 获取包详情 |
| `package_install` | 安装包 |
| `package_uninstall` | 卸载包 |
| `package_list` | 列出已安装包 |
| `package_versions` | 获取可用版本 |
| `package_check_installed` | 检查是否已安装 |
| `package_dependencies` | 获取依赖关系 |
| `package_installed_version` | 获取已安装版本 |
| `package_pin` | 锁定版本 |
| `package_rollback` | 回滚版本 |

---

## 批量操作 (Batch)

| 命令 | 描述 |
|------|------|
| `batch_install` | 批量安装 |
| `batch_uninstall` | 批量卸载 |
| `batch_update` | 批量更新 |
| `batch_status` | 获取批量操作状态 |
| `batch_cancel` | 取消批量操作 |
| `resolve_dependencies` | 解析依赖 |
| `check_updates` | 检查可用更新 |
| `upgrade_all` | 升级所有包 |
| `batch_pin` | 批量锁定版本 |
| `batch_unpin` | 批量解锁版本 |

---

## 下载管理 (Download)

| 命令 | 描述 |
|------|------|
| `download_add` | 添加下载任务 |
| `download_list` | 列出活跃下载 |
| `download_pause` | 暂停下载 |
| `download_resume` | 恢复下载 |
| `download_cancel` | 取消下载 |
| `download_remove` | 移除任务 |
| `download_pause_all` | 暂停所有 |
| `download_resume_all` | 恢复所有 |
| `download_cancel_all` | 取消所有 |
| `download_set_speed_limit` | 设置限速 |
| `download_get_speed_limit` | 获取限速 |
| `download_set_max_concurrent` | 设置最大并发 |
| `download_get_max_concurrent` | 获取最大并发 |
| `download_verify_file` | 验证文件校验和 |
| `download_open_file` | 打开文件 |
| `download_reveal_file` | 在文件管理器中显示 |
| `download_batch_pause` | 批量暂停 |
| `download_batch_resume` | 批量恢复 |
| `download_batch_cancel` | 批量取消 |
| `download_batch_remove` | 批量移除 |
| `download_shutdown` | 优雅关闭 |
| `download_history_*` | 历史记录操作 |

---

## 缓存 (Cache)

| 命令 | 描述 |
|------|------|
| `cache_info` | 缓存统计信息 |
| `cache_clean` | 清理缓存 |
| `cache_verify` | 验证完整性 |
| `cache_repair` | 修复缓存 |
| `get_cache_settings` | 获取缓存设置 |
| `set_cache_settings` | 更新缓存设置 |

---

## 配置 (Config)

| 命令 | 描述 |
|------|------|
| `config_get` | 获取配置值 |
| `config_set` | 设置配置值 |
| `config_list` | 列出所有配置 |
| `config_reset` | 重置配置 |
| `config_export` | 导出配置 |
| `config_import` | 导入配置 |

---

## 搜索 (Search)

| 命令 | 描述 |
|------|------|
| `advanced_search` | 高级搜索 |
| `search_suggestions` | 搜索建议 |
| `compare_packages` | 包对比 |

---

## 自定义检测 (Custom Detection)

| 命令 | 描述 |
|------|------|
| `custom_detection_list` | 列出检测规则 |
| `custom_detection_add` | 添加规则 |
| `custom_detection_update` | 更新规则 |
| `custom_detection_delete` | 删除规则 |
| `custom_detection_test` | 测试规则 |
| `custom_detection_import` | 导入规则集 |
| `custom_detection_export` | 导出规则集 |
| `custom_detection_presets` | 获取预设规则 |
| `custom_detection_validate` | 验证规则 |
| `custom_detection_detect` | 执行检测 |

---

## WSL 管理

| 命令 | 描述 |
|------|------|
| `wsl_list_distros` | 列出已安装发行版 |
| `wsl_list_online` | 列出可安装发行版 |
| `wsl_status` | WSL 状态 |
| `wsl_terminate` | 终止发行版 |
| `wsl_shutdown` | 关闭 WSL |
| `wsl_set_default` | 设置默认 |
| `wsl_set_version` | 设置 WSL 版本 |
| `wsl_set_default_version` | 设置默认 WSL 版本 |
| `wsl_export` | 导出 |
| `wsl_import` | 导入 |
| `wsl_import_in_place` | 就地导入 |
| `wsl_update` | 更新 WSL |
| `wsl_launch` | 启动发行版 |
| `wsl_list_running` | 列出运行中 |
| `wsl_is_available` | 检查可用性 |
| `wsl_mount` | 挂载磁盘 |
| `wsl_unmount` | 卸载磁盘 |
| `wsl_get_ip` | 获取 IP |
| `wsl_change_default_user` | 更改默认用户 |
| `wsl_get_distro_config` | 读取配置 |
| `wsl_set_distro_config` | 写入配置 |

---

## 其他命令

| 模块 | 命令示例 | 描述 |
|------|----------|------|
| Health Check | `health_check_*` | 环境和系统健康检查 |
| Profiles | `profile_*` | 配置快照管理 |
| Launch | `launch_*` | 程序启动 |
| Shim | `shim_*` | Shim 管理 |
| Log | `log_*` | 日志管理 |
| GitHub | `github_*` | GitHub 集成 |
| GitLab | `gitlab_*` | GitLab 集成 |
| Manifest | `manifest_*` | 清单文件管理 |
| Updater | `updater_*` | 应用自更新 |
| FS Utils | `fs_*` | 文件系统工具 |

完整命令列表请参阅 `src-tauri/src/lib.rs` 中的 `invoke_handler` 注册。
