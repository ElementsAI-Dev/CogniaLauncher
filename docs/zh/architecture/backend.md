# 后端架构

CogniaLauncher 后端基于 **Tauri 2.9** + **Rust** 构建，提供原生桌面能力和高性能包管理逻辑。

---

## 入口与启动

### 启动流程

```rust
// src/main.rs → src/lib.rs
fn main() {
    app_lib::run();
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| { /* 日志初始化 */ })
        .manage(Arc::new(RwLock::new(ProviderRegistry::new())))
        .manage(Arc::new(RwLock::new(Settings::default())))
        .invoke_handler(tauri::generate_handler![ /* 217+ 命令 */ ])
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
}
```

### 全局状态

| 状态 | 类型 | 用途 |
|------|------|------|
| ProviderRegistry | `Arc<RwLock<ProviderRegistry>>` | Provider 注册表 |
| Settings | `Arc<RwLock<Settings>>` | 应用配置 |
| CancellationTokens | `Arc<RwLock<HashMap<...>>>` | 安装取消令牌 |
| SharedTrayState | `Arc<RwLock<TrayState>>` | 系统托盘状态 |
| CustomDetectionManager | `Arc<RwLock<...>>` | 自定义检测规则 |
| DownloadManager | `Arc<RwLock<...>>` | 下载任务管理 |

---

## 模块结构

```
src-tauri/src/
├── main.rs              # 入口
├── lib.rs               # Tauri 构建器和命令注册
├── error.rs             # 统一错误类型
├── commands/            # Tauri 命令层（20 个模块）
│   ├── mod.rs           # 模块导出
│   ├── environment.rs   # 环境管理命令
│   ├── package.rs       # 包管理命令
│   ├── config.rs        # 配置命令
│   ├── cache.rs         # 缓存命令
│   ├── batch.rs         # 批量操作命令
│   ├── download.rs      # 下载管理命令
│   ├── search.rs        # 高级搜索命令
│   ├── custom_detection.rs # 自定义检测命令
│   ├── health_check.rs  # 健康检查命令
│   ├── profiles.rs      # 配置快照命令
│   ├── launch.rs        # 程序启动命令
│   ├── shim.rs          # Shim 管理命令
│   ├── log.rs           # 日志命令
│   ├── wsl.rs           # WSL 命令
│   ├── github.rs        # GitHub 集成命令
│   ├── gitlab.rs        # GitLab 集成命令
│   ├── manifest.rs      # 清单文件命令
│   ├── updater.rs       # 自更新命令
│   └── fs_utils.rs      # 文件系统工具命令
├── provider/            # Provider 实现（54 个文件）
│   ├── mod.rs           # Provider 特质定义
│   ├── traits.rs        # 接口定义（Provider/EnvironmentProvider/SystemPackageProvider）
│   ├── registry.rs      # Provider 注册和发现
│   ├── api.rs           # 包 API 客户端（npm/PyPI/crates.io）
│   ├── node_base.rs     # Node.js Provider 共享工具
│   ├── system.rs        # 系统环境检测（10 种运行时）
│   └── [45+ provider].rs # 具体 Provider 实现
├── core/                # 核心业务逻辑
│   ├── batch.rs         # 批量操作引擎
│   ├── orchestrator.rs  # 安装编排器
│   ├── installer.rs     # 安装器
│   ├── environment.rs   # 环境管理
│   ├── custom_detection.rs # 自定义版本检测
│   ├── health_check.rs  # 健康检查引擎
│   ├── profiles.rs      # 配置快照管理
│   ├── history.rs       # 安装历史
│   └── shim.rs          # Shim 管理
├── cache/               # 缓存系统
├── config/              # 配置管理
├── platform/            # 平台抽象
│   ├── disk.rs          # 磁盘操作和工具函数
│   ├── fs.rs            # 文件系统操作
│   └── ...
├── resolver/            # 依赖解析（PubGrub）
└── download/            # 下载引擎
    ├── manager.rs       # 下载管理器
    ├── task.rs          # 下载任务
    └── state.rs         # 下载状态
```

---

## 命令模块统计

| 模块 | 命令数 | 主要功能 |
|------|--------|----------|
| environment | 12 | 环境安装/卸载/版本切换 |
| package | 11 | 包搜索/安装/管理 |
| batch | 10 | 批量操作/依赖解析/版本锁定 |
| download | 22 | 下载队列/历史/限速 |
| cache | 6 | 缓存统计/清理/修复 |
| config | 6 | 配置读写 |
| custom_detection | 10 | 自定义检测规则管理 |
| search | 3 | 高级搜索/建议/对比 |
| wsl | 21 | WSL 管理 |
| 其他 | ~116 | 日志/GitHub/GitLab/更新等 |
| **总计** | **217+** | |

---

## 插件系统

Tauri 插件集成：

- **tauri-plugin-log** — 日志记录（Stdout + WebView + 文件）
- **tauri-plugin-updater** — 应用自更新
- **tauri-plugin-dialog** — 原生对话框
- **tauri-plugin-opener** — 系统程序打开文件
- **tauri-plugin-window-state** — 窗口状态持久化
- **tauri-plugin-notification** — 系统通知
- **tauri-plugin-autostart** — 开机自启

---

## 错误处理

统一使用 `CogniaResult<T>` 类型：

```rust
pub type CogniaResult<T> = Result<T, CogniaError>;
```

错误通过 Tauri IPC 自动序列化为前端可处理的格式。
