# 添加新 Provider

本指南介绍如何为 CogniaLauncher 添加新的包管理器 Provider。

---

## 概述

添加一个新 Provider 需要修改以下文件：

| 文件 | 操作 |
|------|------|
| `src-tauri/src/provider/<name>.rs` | 创建 Provider 实现 |
| `src-tauri/src/provider/mod.rs` | 添加模块声明 |
| `src-tauri/src/provider/registry.rs` | 注册 Provider |
| `messages/en.json` | 添加英文文本（如需） |
| `messages/zh.json` | 添加中文文本（如需） |

---

## 步骤 1：实现 Provider

创建 `src-tauri/src/provider/<name>.rs`：

```rust
use super::traits::*;
use crate::error::CogniaResult;

pub struct MyProvider {
    // 配置字段
}

impl MyProvider {
    pub fn new() -> Self {
        Self { /* ... */ }
    }
}

#[async_trait::async_trait]
impl Provider for MyProvider {
    fn id(&self) -> &str { "my-provider" }
    fn display_name(&self) -> &str { "My Package Manager" }
    fn provider_type(&self) -> ProviderType { ProviderType::PackageManager }

    fn capabilities(&self) -> Vec<Capability> {
        vec![
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
        ]
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> u32 { 50 }

    async fn is_available(&self) -> bool {
        // 检查包管理器是否安装
        process::which("my-pm").is_some()
    }

    async fn search(&self, query: &str, opts: &SearchOptions)
        -> CogniaResult<Vec<SearchResult>>
    {
        // 实现搜索逻辑
        todo!()
    }

    async fn install(&self, req: &InstallRequest)
        -> CogniaResult<InstallReceipt>
    {
        // 实现安装逻辑
        todo!()
    }

    // ... 其他方法
}
```

### 关键实现要点

1. **`is_available()`** — 必须验证可执行文件存在且可运行
2. **超时** — 所有外部进程调用必须设置超时（推荐 120s）
3. **错误处理** — 使用 `CogniaResult<T>` 统一错误类型
4. **进度报告** — 长时间操作使用 `ProgressCallback`
5. **UTF-8 处理** — Windows 上注意 BOM 和编码问题

---

## 步骤 2：注册模块

在 `src-tauri/src/provider/mod.rs` 中添加：

```rust
pub mod my_provider;
```

---

## 步骤 3：注册到 Registry

在 `src-tauri/src/provider/registry.rs` 中添加：

```rust
use super::my_provider::MyProvider;

// 在 register_providers() 函数中
registry.register(Box::new(MyProvider::new()));
```

按平台条件注册：

```rust
#[cfg(target_os = "windows")]
registry.register(Box::new(MyProvider::new()));
```

---

## 步骤 4：添加单元测试

在 Provider 文件底部添加测试：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = MyProvider::new();
        assert_eq!(p.id(), "my-provider");
        assert!(!p.capabilities().is_empty());
    }

    #[test]
    fn test_parse_output() {
        // 测试输出解析逻辑
    }
}
```

---

## 步骤 5：验证

```bash
# Rust 编译检查
cargo check

# 运行测试
cargo test my_provider

# 前端 lint（确保无回归）
pnpm lint
```

---

## 可选：实现扩展特质

### EnvironmentProvider

如果是版本管理器（如 nvm、pyenv），额外实现 `EnvironmentProvider`：

- `env_type()` — 环境类型标识
- `get_current_version()` — 获取当前版本
- `set_global_version()` — 设置全局版本
- `set_local_version()` — 设置项目级版本

### SystemPackageProvider

提供系统级信息：

- `get_version()` — Provider 自身版本
- `get_executable_path()` — 可执行文件路径
- `get_install_instructions()` — 安装说明

---

## 现有 Provider 参考

| 复杂度 | 推荐参考 |
|--------|----------|
| 简单 | `snap.rs`、`flatpak.rs` |
| 中等 | `brew.rs`、`pip.rs` |
| 复杂 | `winget.rs`、`sdkman.rs` |
| 环境管理 | `nvm.rs`、`pyenv.rs` |
