# Tauri 命令参考

CogniaLauncher 后端提供 288 条 Tauri 命令，跨 21 个模块，通过 IPC 供前端调用。

---

## 环境管理 (Environment) — 48 条

| 命令 | 描述 |
|------|------|
| `env_list` | 列出所有环境类型 |
| `env_get` | 获取环境详情 |
| `env_install` | 安装运行时版本（含进度事件） |
| `env_uninstall` | 卸载运行时版本 |
| `env_use_global` | 设置全局版本 |
| `env_use_local` | 设置项目级版本 |
| `env_detect` | 检测已安装版本 |
| `env_detect_all` | 检测所有环境 |
| `env_available_versions` | 获取可用版本列表 |
| `env_list_providers` | 列出环境 Provider |
| `env_resolve_alias` | 解析版本别名（lts, latest, stable） |
| `env_save_settings` | 保存环境设置 |
| `env_load_settings` | 加载环境设置 |
| `env_install_cancel` | 取消安装 |
| `env_detect_system_all` | 检测所有系统安装的环境 |
| `env_detect_system` | 检测指定系统环境 |
| `env_get_type_mapping` | 获取 Provider→环境类型映射 |
| `env_verify_install` | 验证安装结果 |
| `env_installed_versions` | 获取已安装版本列表 |
| `env_current_version` | 获取当前活跃版本 |
| `env_get_eol_info` | 获取 EOL 生命周期数据 |
| `env_get_version_eol` | 获取版本 EOL 状态 |
| `env_check_updates` | 检查环境更新 |
| `env_check_updates_all` | 批量检查所有环境更新 |
| `env_cleanup_versions` | 批量清理旧版本 |
| `env_list_global_packages` | 列出全局包 |
| `env_migrate_packages` | 迁移全局包 |
| `rustup_*` (9 条) | Rustup 组件/目标/自更新管理 |
| 其他 12 条 | 环境高级操作 |

---

## 包管理 (Package) — 13 条

| 命令 | 描述 |
|------|------|
| `package_search` | 搜索包 |
| `package_info` | 获取包详情 |
| `package_install` | 安装包 |
| `package_uninstall` | 卸载包 |
| `package_list` | 列出已安装包 |
| `package_versions` | 获取可用版本 |
| `package_check_installed` | 检查是否已安装 |
| `provider_list` | 列出所有 Provider |
| `provider_check` | 检查 Provider 可用性 |
| `provider_system_list` | 列出系统包管理器 |
| `provider_status_all` | 所有 Provider 状态 |
| `provider_enable` | 启用 Provider |
| `provider_disable` | 禁用 Provider |

---

## 批量操作 (Batch) — 12 条

| 命令 | 描述 |
|------|------|
| `batch_install` | 批量安装 |
| `batch_uninstall` | 批量卸载 |
| `batch_update` | 批量更新 |
| `resolve_dependencies` | 解析依赖 |
| `check_updates` | 检查可用更新 |
| `package_pin` | 锁定版本 |
| `package_unpin` | 解锁版本 |
| `get_pinned_packages` | 列出锁定的包 |
| `package_rollback` | 回滚版本 |
| `get_install_history` | 获取安装历史 |
| `get_package_history` | 获取包历史 |
| `clear_install_history` | 清除安装历史 |

---

## 下载管理 (Download) — 32 条

| 命令 | 描述 |
|------|------|
| `download_add` | 添加下载任务（支持缓存命中） |
| `download_get` | 获取下载任务详情 |
| `download_list` | 列出活跃下载 |
| `download_stats` | 下载队列统计 |
| `download_pause` | 暂停下载 |
| `download_resume` | 恢复下载 |
| `download_cancel` | 取消下载 |
| `download_remove` | 移除任务 |
| `download_pause_all` | 暂停所有 |
| `download_resume_all` | 恢复所有 |
| `download_cancel_all` | 取消所有 |
| `download_clear_finished` | 清除已完成 |
| `download_retry_failed` | 重试失败任务 |
| `download_set_speed_limit` | 设置限速 |
| `download_get_speed_limit` | 获取限速 |
| `download_set_max_concurrent` | 设置最大并发 |
| `download_get_max_concurrent` | 获取最大并发 |
| `download_shutdown` | 优雅关闭 |
| `download_verify_file` | 验证文件校验和 |
| `download_open_file` | 打开文件 |
| `download_reveal_file` | 在文件管理器中显示 |
| `download_batch_pause` | 批量暂停 |
| `download_batch_resume` | 批量恢复 |
| `download_batch_cancel` | 批量取消 |
| `download_batch_remove` | 批量移除 |
| `download_history_list` | 下载历史列表 |
| `download_history_search` | 搜索历史 |
| `download_history_stats` | 历史统计 |
| `download_history_clear` | 清除历史 |
| `download_history_remove` | 删除历史条目 |
| `disk_space_get` | 获取磁盘空间 |
| `disk_space_check` | 检查磁盘空间 |

---

## 缓存 (Cache) — 32 条

| 命令 | 描述 |
|------|------|
| `cache_info` | 缓存统计信息 |
| `cache_clean` | 清理缓存 |
| `cache_verify` | 验证完整性 |
| `cache_repair` | 修复缓存 |
| `get_cache_settings` | 获取缓存设置 |
| `set_cache_settings` | 更新缓存设置 |
| `cache_clean_preview` | 预览清理结果 |
| `cache_clean_enhanced` | 增强清理（回收站支持） |
| `get_cleanup_history` | 清理历史 |
| `clear_cleanup_history` | 清除清理历史 |
| `get_cleanup_summary` | 清理统计摘要 |
| `get_cache_access_stats` | 缓存访问统计（命中率） |
| `reset_cache_access_stats` | 重置访问统计 |
| `list_cache_entries` | 列出缓存条目（支持过滤分页） |
| `delete_cache_entry` | 删除缓存条目 |
| `delete_cache_entries` | 批量删除缓存条目 |
| `get_top_accessed_entries` | 热门缓存条目 |
| `discover_external_caches` | 发现外部缓存 |
| `clean_external_cache` | 清理外部缓存 |
| `clean_all_external_caches` | 清理所有外部缓存 |
| `get_combined_cache_stats` | 组合缓存统计 |
| `cache_size_monitor` | 缓存大小监控 |
| `get_cache_path_info` | 缓存路径信息 |
| `set_cache_path` | 设置缓存路径 |
| `reset_cache_path` | 重置缓存路径 |
| `cache_migration_validate` | 迁移验证 |
| `cache_migrate` | 执行迁移 |
| `cache_force_clean` | 强制清理 |
| `cache_force_clean_external` | 强制清理外部缓存 |
| `get_external_cache_paths` | 外部缓存路径 |
| `get_enhanced_cache_settings` | 增强缓存设置 |
| `set_enhanced_cache_settings` | 更新增强缓存设置 |

---

## Git 管理 — 17 条

| 命令 | 描述 |
|------|------|
| `git_is_available` | 检查 git 是否可用 |
| `git_get_version` | 获取 git 版本 |
| `git_get_executable_path` | 获取 git 路径 |
| `git_install` | 安装 git |
| `git_update` | 更新 git |
| `git_get_config` | 获取全局配置 |
| `git_set_config` | 设置全局配置 |
| `git_remove_config` | 删除配置项 |
| `git_get_repo_info` | 获取仓库信息 |
| `git_get_log` | 获取提交日志 |
| `git_get_branches` | 获取分支列表 |
| `git_get_remotes` | 获取远程仓库 |
| `git_get_tags` | 获取标签列表 |
| `git_get_stashes` | 获取 stash 列表 |
| `git_get_contributors` | 获取贡献者 |
| `git_get_file_history` | 获取文件修改历史 |
| `git_get_blame` | 获取 blame 信息 |

---

## 配置 (Config) — 9 条

| 命令 | 描述 |
|------|------|
| `config_get` | 获取配置值 |
| `config_set` | 设置配置值 |
| `config_list` | 列出所有配置 |
| `config_reset` | 重置配置 |
| `config_export` | 导出配置为 TOML |
| `config_import` | 从 TOML 导入配置 |
| `get_cognia_dir` | 获取数据目录 |
| `get_platform_info` | 获取平台信息 |
| `app_check_init` | 检查初始化状态 |

---

## 搜索 (Search) — 3 条

| 命令 | 描述 |
|------|------|
| `advanced_search` | 高级搜索（过滤、评分、分页） |
| `search_suggestions` | 搜索建议自动完成 |
| `compare_packages` | 包对比 |

---

## 自定义检测 (Custom Detection) — 16 条

| 命令 | 描述 |
|------|------|
| `custom_rule_list` | 列出检测规则 |
| `custom_rule_get` | 获取指定规则 |
| `custom_rule_add` | 添加规则 |
| `custom_rule_update` | 更新规则 |
| `custom_rule_delete` | 删除规则 |
| `custom_rule_toggle` | 启用/禁用规则 |
| `custom_rule_presets` | 获取预设规则 |
| `custom_rule_import_presets` | 导入预设 |
| `custom_rule_detect` | 执行检测 |
| `custom_rule_detect_all` | 检测所有版本 |
| `custom_rule_test` | 测试规则 |
| `custom_rule_validate_regex` | 验证正则 |
| `custom_rule_export` | 导出规则 |
| `custom_rule_import` | 导入规则 |
| `custom_rule_list_by_env` | 按环境类型筛选 |
| `custom_rule_extraction_types` | 获取提取策略列表 |

---

## WSL 管理 — 26 条

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
| `wsl_exec` | 执行命令 |
| `wsl_convert_path` | 路径转换 |
| `wsl_get_config` | 读取 .wslconfig |
| `wsl_set_config` | 写入 .wslconfig |
| `wsl_disk_usage` | 磁盘使用量 |
| `wsl_mount` | 挂载磁盘 |
| `wsl_unmount` | 卸载磁盘 |
| `wsl_get_ip` | 获取 IP |
| `wsl_change_default_user` | 更改默认用户 |
| `wsl_get_distro_config` | 读取 wsl.conf |
| `wsl_set_distro_config` | 写入 wsl.conf |

---

## 其他命令模块

| 模块 | 命令数 | 命令前缀 | 描述 |
|------|--------|----------|------|
| Health Check | 4 | `health_check_*` | 环境和系统健康检查 |
| Profiles | 9 | `profile_*` | 配置快照管理 |
| Launch | 6 | `launch_with_env`, `env_activate`, `exec_shell_with_env`, `which_program` | 程序启动和环境激活 |
| Shim/PATH | 10 | `shim_*`, `path_*` | Shim 创建和 PATH 管理 |
| Log | 6 | `log_*` | 日志管理 |
| GitHub | 13 | `github_*` | GitHub Releases 集成 |
| GitLab | 15 | `gitlab_*` | GitLab Releases 集成 |
| Tray | 12 | `tray_*` | 系统托盘管理 |
| Manifest | 2 | `manifest_read`, `manifest_init` | 项目清单文件 (cognia.toml) |
| Updater | 2 | `self_check_update`, `self_update` | 应用自更新 |
| FS Utils | 1 | `validate_path` | 路径验证和安全检查 |

完整命令列表请参阅 `src-tauri/src/lib.rs` 中的 `invoke_handler` 注册。
