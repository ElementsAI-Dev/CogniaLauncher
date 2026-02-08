# 贡献指南

## 代码风格

### TypeScript / React

- **ESLint** 是代码风格的权威来源（`eslint.config.mjs`）
- 组件使用 **PascalCase** 命名和导出
- 文件使用 **kebab-case** 命名
- 变量和函数使用 **camelCase**
- Hooks 以 `use` 开头
- 样式使用 Tailwind CSS 工具类
- 类名合并使用 `cn()` 工具函数

### Rust

- 遵循标准 Rust 命名约定
- 使用 `cargo clippy` 检查
- 错误处理统一使用 `CogniaResult<T>`
- Provider 实现遵循特质接口

### 导入规范

- 使用 `@/` 路径别名
- 导入语句放在文件顶部
- 按类型分组：外部库 → 内部模块 → 类型

---

## 提交规范

使用 **Conventional Commits**：

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### 类型

| 类型 | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档更新 |
| `refactor` | 代码重构 |
| `chore` | 构建/工具变更 |
| `ci` | CI/CD 变更 |
| `test` | 测试相关 |
| `style` | 代码格式（不影响逻辑） |
| `perf` | 性能优化 |

### 示例

```text
feat(provider): add xmake/xrepo C++ package manager

- Implement XmakeProvider with search/install/uninstall/list
- Add xrepo info parsing for package details
- Register in provider registry after conan

Closes #42
```

---

## PR 流程

1. Fork 仓库并创建功能分支
2. 在分支上开发，保持提交原子性
3. 确保通过 `pnpm lint` 和 `pnpm test`
4. 后端改动需通过 `cargo check`
5. 提交 PR，包含：
   - 简要描述变更范围和意图
   - UI 变更附截图
   - 验证步骤
6. 等待代码审查

---

## i18n 规范

添加新的用户可见文本时：

1. 在 `messages/en.json` 和 `messages/zh.json` 中添加对应键
2. 保持两个文件的键完全同步（当前 1640+ 键）
3. 使用嵌套结构组织键名
4. 组件中使用 `useTranslations()` 获取翻译

---

## 安全注意事项

- 不要在代码中硬编码密钥或 Token
- 使用 `.env.local` 存储本地开发密钥
- Tauri 配置中最小化权限声明
- 不在日志中输出敏感信息
