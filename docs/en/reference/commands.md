# Tauri Command Reference

CogniaLauncher's backend provides 289 Tauri commands across 21 modules, called by the frontend via IPC.

---

## Desktop CLI (Headless)

The desktop binary also exposes CLI subcommands via the Tauri CLI plugin (`src-tauri/src/cli.rs`, `src-tauri/tauri.conf.json`).

Top-level commands:

- `search`, `install`, `uninstall`, `list`, `update`, `info`, `env`, `config`, `cache`, `doctor`, `providers`

Notable options:

- `install` / `uninstall`: `--provider`, `--force`
- `list`: `--provider`, `--outdated`
- `env`: `list`, `install`, `use`, `detect`, `remove`, `resolve`
- `config`: `get`, `set`, `list`, `reset`, `export`, `import`
- `envvar`: `list`, `get`, `set`, `remove`, `list-persistent`, `list-persistent-typed`, `set-persistent`, `remove-persistent`, `get-path`, `add-path`, `remove-path`, `reorder-path`, `deduplicate-path`, `detect-conflicts`, `list-shell-profiles`, `read-shell-profile`, `expand-path`, `export`, `import`, `preview-import`, `apply-import`, `preview-path-repair`, `apply-path-repair`, `resolve-conflict`, `shell-guidance`

Envvar mutation commands now distinguish readiness and verified outcomes. For example, `set`, `remove`, `import`, `apply-import`, `deduplicate-path`, `apply-path-repair`, and `resolve-conflict` can report blocked or manual-follow-up states instead of implying every successful command invocation was fully verified.

---

## Environment Management — 48 Commands

| Command | Description |
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

## Git 管理 — 143 条（按能力分组）

> 统计口径：`src-tauri/src/commands/git.rs` 中 `fn git_*` 共 143 条，并与 `src-tauri/src/lib.rs` `invoke_handler`、`lib/tauri.ts` 保持 1:1 对齐。

| 分组 | 数量 | 命令（完整） |
|------|------|------|
| 核心与全局配置 | 13 | `git_is_available`, `git_get_version`, `git_get_executable_path`, `git_install`, `git_update`, `git_get_config`, `git_set_config`, `git_remove_config`, `git_get_config_value`, `git_get_config_file_path`, `git_list_aliases`, `git_set_config_if_unset`, `git_open_config_in_editor` |
| 仓库读取与分析 | 20 | `git_get_repo_info`, `git_get_log`, `git_get_branches`, `git_get_remotes`, `git_get_tags`, `git_get_stashes`, `git_get_contributors`, `git_get_file_history`, `git_get_blame`, `git_get_commit_detail`, `git_get_status`, `git_get_graph_log`, `git_get_ahead_behind`, `git_get_activity`, `git_get_file_stats`, `git_search_commits`, `git_get_diff`, `git_get_diff_between`, `git_get_commit_diff`, `git_get_reflog` |
| 核心写操作与同步 | 27 | `git_checkout_branch`, `git_create_branch`, `git_delete_branch`, `git_stash_apply`, `git_stash_pop`, `git_stash_drop`, `git_stash_save`, `git_create_tag`, `git_delete_tag`, `git_stage_files`, `git_stage_all`, `git_unstage_files`, `git_discard_changes`, `git_commit`, `git_push`, `git_pull`, `git_fetch`, `git_init`, `git_merge`, `git_revert`, `git_cherry_pick`, `git_reset`, `git_push_tags`, `git_stash_show`, `git_clean`, `git_clean_dry_run`, `git_stash_push_files` |
| 克隆与 URL 工具 | 4 | `git_clone`, `git_cancel_clone`, `git_extract_repo_name`, `git_validate_url` |
| 远端与分支维护 | 8 | `git_remote_add`, `git_remote_remove`, `git_remote_rename`, `git_remote_set_url`, `git_branch_rename`, `git_branch_set_upstream`, `git_delete_remote_branch`, `git_remote_prune` |
| Submodules | 5 | `git_list_submodules`, `git_add_submodule`, `git_update_submodules`, `git_remove_submodule`, `git_sync_submodules` |
| Worktrees | 4 | `git_list_worktrees`, `git_add_worktree`, `git_remove_worktree`, `git_prune_worktrees` |
| .gitignore 与 Hooks | 8 | `git_get_gitignore`, `git_set_gitignore`, `git_check_ignore`, `git_add_to_gitignore`, `git_list_hooks`, `git_get_hook_content`, `git_set_hook_content`, `git_toggle_hook` |
| Git LFS | 7 | `git_lfs_is_available`, `git_lfs_get_version`, `git_lfs_tracked_patterns`, `git_lfs_ls_files`, `git_lfs_track`, `git_lfs_untrack`, `git_lfs_install` |
| 冲突处理与 Rebase 流程 | 16 | `git_rebase`, `git_rebase_abort`, `git_rebase_continue`, `git_rebase_skip`, `git_squash`, `git_get_merge_rebase_state`, `git_get_conflicted_files`, `git_resolve_file_ours`, `git_resolve_file_theirs`, `git_resolve_file_mark`, `git_merge_abort`, `git_merge_continue`, `git_cherry_pick_abort`, `git_cherry_pick_continue`, `git_revert_abort`, `git_stash_branch` |
| Local Config / Shallow / Stats / Signature | 12 | `git_get_local_config`, `git_set_local_config`, `git_remove_local_config`, `git_get_local_config_value`, `git_is_shallow`, `git_deepen`, `git_unshallow`, `git_get_repo_stats`, `git_fsck`, `git_describe`, `git_verify_commit`, `git_verify_tag` |
| Interactive Rebase 与 Bisect | 9 | `git_get_rebase_todo_preview`, `git_start_interactive_rebase`, `git_bisect_start`, `git_bisect_good`, `git_bisect_bad`, `git_bisect_skip`, `git_bisect_reset`, `git_bisect_log`, `git_get_bisect_state` |
| Sparse Checkout | 6 | `git_is_sparse_checkout`, `git_sparse_checkout_init`, `git_sparse_checkout_set`, `git_sparse_checkout_add`, `git_sparse_checkout_list`, `git_sparse_checkout_disable` |
| Archive 与 Patch | 4 | `git_archive`, `git_format_patch`, `git_apply_patch`, `git_apply_mailbox` |

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

## 日志与诊断 — 11 条

| 命令 | 描述 |
|------|------|
| `log_list_files` | 列出日志文件 |
| `log_query` | 查询日志（级别/时间/关键词 + 分页，支持 `max_scan_lines`） |
| `log_export` | 导出日志（TXT/JSON，支持 `.log` 与 `.log.gz`） |
| `log_get_dir` | 获取日志目录 |
| `log_get_total_size` | 获取日志总大小 |
| `log_clear` | 清理日志文件 |
| `diagnostic_export_bundle` | 手动导出完整诊断包 |
| `diagnostic_get_default_export_path` | 获取默认导出路径 |
| `diagnostic_check_last_crash` | 检查上次崩溃 marker |
| `diagnostic_dismiss_crash` | 清除崩溃 marker |
| `diagnostic_capture_frontend_crash` | 捕获前端未处理异常并生成崩溃诊断包 |

> 说明：`log_query` 的 `offset` 从日志尾部向前分页。在跟随模式中可配合 `max_scan_lines` 限制扫描行数，降低大文件轮询开销。

---

## 其他命令模块

| 模块 | 命令数 | 命令前缀 | 描述 |
|------|--------|----------|------|
| Health Check | 5 | `health_check_*` | Environment, provider, and remediation health workflows |
| Profiles | 9 | `profile_*` | 配置快照管理 |
| Launch | 6 | `launch_with_env`, `env_activate`, `exec_shell_with_env`, `which_program` | 程序启动和环境激活 |
| Shim/PATH | 10 | `shim_*`, `path_*` | Shim 创建和 PATH 管理 |
| Log | 6 | `log_*` | 日志管理 |
| Diagnostic | 5 | `diagnostic_*` | 诊断包导出、崩溃恢复与前端异常自动采集 |
| GitHub | 13 | `github_*` | GitHub Releases 集成 |
| GitLab | 15 | `gitlab_*` | GitLab Releases 集成 |
| Tray | 12 | `tray_*` | 系统托盘管理 |
| Manifest | 2 | `manifest_read`, `manifest_init` | 项目清单文件 (cognia.toml) |
| Updater | 2 | `self_check_update`, `self_update` | 应用自更新 |
| FS Utils | 1 | `validate_path` | 路径验证和安全检查 |

完整命令列表请参阅 `src-tauri/src/lib.rs` 中的 `invoke_handler` 注册。
