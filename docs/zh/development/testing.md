# 测试指南

CogniaLauncher 使用 Jest 30 + Testing Library 进行前端测试，Rust 内置测试框架进行后端测试。

---

## 前端测试

### 测试栈

| 工具 | 用途 |
|------|------|
| Jest 30 | 测试运行器 |
| @testing-library/react | 组件测试 |
| @testing-library/jest-dom | DOM 断言扩展 |
| jest-environment-jsdom | 浏览器模拟环境 |

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage

# 运行特定文件
pnpm test -- --testPathPattern="environment-list"
```

### 文件组织

测试文件与源文件并列放置：

```text
components/
├── dashboard/
│   ├── environment-list.tsx        # 组件
│   └── environment-list.test.tsx   # 测试
hooks/
├── use-environments.ts             # Hook
└── use-environments.test.ts        # 测试
lib/
└── __tests__/
    └── utils.test.ts               # 工具函数测试
```

### 组件测试示例

```tsx
import { render, screen } from "@testing-library/react";
import { EnvironmentList } from "./environment-list";

describe("EnvironmentList", () => {
  it("renders environment items", () => {
    render(
      <EnvironmentList
        environments={[
          { name: "Node.js", version: "20.11.0", type: "nodejs" },
        ]}
      />
    );
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("20.11.0")).toBeInTheDocument();
  });
});
```

### Mock 策略

- **Tauri API**：通过 `jest.mock("@tauri-apps/api")` 模拟
- **Zustand Store**：通过 `jest.mock("@/lib/stores/xxx")` 模拟
- **next-intl**：使用自定义 mock 返回键名
- **静态资源**：通过 `__mocks__/fileMock.js` 和 `styleMock.js`

---

## 后端测试

### Rust 单元测试

```bash
# 运行所有测试
cargo test

# 运行特定模块测试
cargo test winget
cargo test sdkman

# 带输出
cargo test -- --nocapture
```

### 测试示例

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_output() {
        let output = "package-name  1.0.0  description";
        let result = parse_search_output(output);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "package-name");
    }

    #[test]
    fn test_provider_capabilities() {
        let provider = MyProvider::new();
        assert!(provider.capabilities().contains(&Capability::Install));
    }
}
```

---

## 覆盖率

### 前端覆盖率

```bash
pnpm test:coverage
```

输出报告到 `coverage/` 目录，包含：

- 行覆盖率
- 分支覆盖率
- 函数覆盖率
- 文件级详情

### 优先测试目标

1. `lib/` 工具函数 — 纯逻辑，易测试
2. 自定义 Hooks — 业务逻辑核心
3. 复杂 UI 组件 — 包含交互逻辑的组件
4. Rust Provider 解析函数 — 输出解析容易出错

---

## CI 集成

测试在 GitHub Actions 中自动运行：

- **每次 Push** 触发 lint + test
- **PR** 触发完整测试套件
- 测试结果和覆盖率报告上传为 Artifact

详见 [CI/CD](ci-cd.md)。

---

## E2E 测试

### 测试栈

| 工具 | 用途 |
|------|------|
| Playwright 1.58+ | E2E 测试框架 |
| Chromium | 默认浏览器 |

### 运行测试

```bash
# 运行所有 E2E 测试
pnpm test:e2e

# 使用 Playwright UI 运行
pnpm test:e2e:ui

# 有头模式运行（可观察浏览器）
pnpm test:e2e:headed

# 仅运行特定文件
pnpm test:e2e -- e2e/navigation.spec.ts
```

### 文件组织

E2E 测试文件位于 `e2e/` 目录：

```text
e2e/
├── fixtures/
│   └── app-fixture.ts      # 共享 fixture（等待应用就绪、选择器）
├── navigation.spec.ts      # 侧边栏导航、面包屑、路由
├── dashboard.spec.ts       # 仪表板页面
├── environments.spec.ts    # 环境管理页面
├── packages.spec.ts        # 包管理页面
├── providers.spec.ts       # 提供商页面
├── cache.spec.ts           # 缓存页面（概览 + 子路由）
├── downloads.spec.ts       # 下载管理页面
├── git.spec.ts             # Git 页面（Web 回退）
├── wsl.spec.ts             # WSL 页面（Web 回退）
├── logs.spec.ts            # 日志页面
├── settings.spec.ts        # 设置页面
├── about.spec.ts           # 关于页面
├── docs.spec.ts            # 文档查看器
├── theme-locale.spec.ts    # 主题/语言切换
├── keyboard.spec.ts        # 快捷键和命令面板
├── responsive.spec.ts      # 响应式布局
└── error-handling.spec.ts  # 错误/404 页面
```

### 注意事项

- E2E 测试运行于 Web 模式（`pnpm dev`），不依赖 Tauri 桌面端
- 桌面端专属功能（WSL、Git 管理等）在 Web 模式下测试其回退状态
- 配置文件：`playwright.config.ts`（项目根目录）
