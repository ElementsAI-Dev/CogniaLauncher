# 添加 Tauri 命令

本指南介绍如何添加新的 Tauri IPC 命令。

---

## 概述

Tauri 命令是前后端通信的桥梁。添加新命令需要修改以下文件：

### 后端

| 文件 | 操作 |
|------|------|
| `src-tauri/src/commands/<module>.rs` | 实现命令函数 |
| `src-tauri/src/commands/mod.rs` | 导出命令 |
| `src-tauri/src/lib.rs` | 注册到 invoke_handler |

### 前端

| 文件 | 操作 |
|------|------|
| `lib/tauri.ts` | 添加 TypeScript 封装 |
| `types/tauri.ts` | 添加类型定义（如需） |
| `hooks/use-*.ts` | 添加到相关 Hook（如需） |

---

## 步骤 1：实现后端命令

在 `src-tauri/src/commands/<module>.rs` 中：

```rust
use tauri::State;
use std::sync::{Arc, RwLock};
use crate::provider::registry::ProviderRegistry;
use crate::error::CogniaResult;

#[tauri::command]
pub async fn my_new_command(
    registry: State<'_, Arc<RwLock<ProviderRegistry>>>,
    param1: String,
    param2: Option<u32>,
) -> Result<MyResponse, String> {
    let registry = registry.read().map_err(|e| e.to_string())?;
    // 业务逻辑
    Ok(MyResponse { /* ... */ })
}
```

### 命名约定

- 使用 `snake_case`
- 按模块前缀分组：`env_*`、`package_*`、`download_*`、`cache_*`
- 返回 `Result<T, String>`（Tauri 要求错误类型为 String）

---

## 步骤 2：导出和注册

在 `src-tauri/src/commands/mod.rs` 中导出：

```rust
pub use my_module::my_new_command;
```

在 `src-tauri/src/lib.rs` 的 `invoke_handler` 中注册：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令
    commands::my_module::my_new_command,
])
```

---

## 步骤 3：前端封装

在 `lib/tauri.ts` 中添加 TypeScript 封装：

```typescript
export async function myNewCommand(
  param1: string,
  param2?: number
): Promise<MyResponse> {
  return invoke("my_new_command", { param1, param2 });
}
```

如果有新的数据类型，在 `types/tauri.ts` 中定义：

```typescript
export interface MyResponse {
  field1: string;
  field2: number;
}
```

---

## 步骤 4：集成到 Hook

在相关的 Hook 文件中暴露给组件：

```typescript
// hooks/use-my-feature.ts
import { myNewCommand } from "@/lib/tauri";

export function useMyFeature() {
  const doSomething = useCallback(async (param: string) => {
    if (!isTauri()) return;
    const result = await myNewCommand(param);
    // 处理结果
  }, []);

  return { doSomething };
}
```

---

## 步骤 5：验证

```bash
# 后端编译检查
cargo check

# 前端 lint
pnpm lint

# 确认命令计数一致
# invoke_handler 中的命令数 = #[tauri::command] 标记的函数数
```

!!! tip "命令计数"
    当前项目有 217+ 命令，`invoke_handler` 中的注册数必须与 `#[tauri::command]` 标记的函数数完全匹配。
