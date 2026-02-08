# 错误处理

CogniaLauncher 的错误处理策略覆盖前后端各层。

---

## 后端错误处理

### 统一错误类型

```rust
// src-tauri/src/error.rs
pub type CogniaResult<T> = Result<T, CogniaError>;

pub enum CogniaError {
    Provider(String),
    Network(String),
    Io(std::io::Error),
    Config(String),
    Cache(String),
    Timeout(String),
    NotFound(String),
    PermissionDenied(String),
    // ...
}
```

### Tauri 命令错误

Tauri 命令返回 `Result<T, String>`，`CogniaError` 自动转换为 `String`：

```rust
#[tauri::command]
pub async fn my_command() -> Result<Data, String> {
    let result = do_something().map_err(|e| e.to_string())?;
    Ok(result)
}
```

### Provider 错误处理

- 单个 Provider 失败不影响其他 Provider
- 超时错误有专门处理（120s 默认，600s 长时操作）
- 网络错误支持重试（可配置重试次数）

---

## 前端错误处理

### React 错误边界

```
app/
├── error.tsx         # 路由级错误边界
├── global-error.tsx  # 全局错误边界
└── not-found.tsx     # 404 页面
```

每个路由页面都有 `error.tsx` 捕获渲染错误。

### Tauri API 错误

前端通过 try-catch 处理 Tauri 调用错误：

```typescript
try {
  const result = await invoke("command_name", args);
} catch (error) {
  // 显示用户友好的错误消息
  toast.error(String(error));
}
```

### isTauri 守卫

所有 Tauri API 调用前检查运行环境：

```typescript
if (isTauri()) {
  // 桌面模式：调用 Tauri API
} else {
  // Web 模式：使用 fallback 或显示提示
}
```

---

## 错误分类

| 类别 | 处理方式 | 用户提示 |
|------|----------|----------|
| 网络超时 | 自动重试 | "网络连接超时，正在重试..." |
| 包未找到 | 返回空结果 | "未找到匹配的包" |
| 权限不足 | 提示提升权限 | "需要管理员权限" |
| 磁盘空间不足 | 阻止操作 | "磁盘空间不足" |
| Provider 不可用 | 跳过该 Provider | "xx 包管理器未安装" |
| 版本冲突 | 显示冲突详情 | "版本 x.y.z 与 a.b.c 冲突" |
| 配置错误 | 提供修复建议 | "配置文件格式错误" |

---

## 日志记录

所有错误都记录到日志系统：

- **Error 级别** — 操作失败、异常
- **Warn 级别** — 可恢复的问题
- **Info 级别** — 正常操作日志
- **Debug 级别** — 调试信息

日志格式：`[TIMESTAMP][LEVEL][TARGET] MESSAGE`
