# 文档质量与同步

本页定义英文与中文文档保持一致且可验证的基线策略。

## EN/ZH 核心页面对齐映射

以下核心页面必须同时存在于 `docs/en` 与 `docs/zh`：

| 分区 | 英文路径 | 中文路径 |
|------|----------|----------|
| 首页 | `docs/en/index.md` | `docs/zh/index.md` |
| 快速开始 | `docs/en/getting-started/index.md` | `docs/zh/getting-started/index.md` |
| 使用指南 | `docs/en/guide/index.md` | `docs/zh/guide/index.md` |
| 开发者指南 | `docs/en/development/index.md` | `docs/zh/development/index.md` |
| 架构设计 | `docs/en/architecture/index.md` | `docs/zh/architecture/index.md` |
| 参考文档 | `docs/en/reference/index.md` | `docs/zh/reference/index.md` |
| 设计文档 | `docs/en/design/index.md` | `docs/zh/design/index.md` |
| 附录 | `docs/en/appendix/index.md` | `docs/zh/appendix/index.md` |

## 基线例外

- 当前基线例外：**无**。
- 如需新增例外，必须在同一个 PR 中记录：
  - 原因，
  - 预计移除日期，
  - 责任人。

## 责任规则

- 功能负责人需要同步更新两套语言文档中的受影响页面。
- Reviewer 需要核对文档影响声明与 no-doc-impact 理由是否充分。
- CI 在迁移阶段先以 warning 模式运行文档校验，基线稳定后切换到 enforce 模式。

## 校验命令

提交 PR 前运行：

```bash
pnpm docs:validate
```

迁移期的非阻塞校验（CI 使用）：

```bash
pnpm docs:validate:warn
```

## 文档影响评审门禁

涉及用户行为或开发流程的变更必须满足以下之一：

1. 在同一 PR 中更新相关文档；或
2. 提供带具体理由的 no-doc-impact 说明。

## 需求覆盖映射

| 规范要求 | 对应实现校验 / 门禁 |
|----------|---------------------|
| EN/ZH 核心页面对齐 | `pnpm docs:validate` 的 parity 校验（`requiredCorePages`） |
| 文档链接与引用有效 | `pnpm docs:validate` 的内部链接与锚点校验 |
| 文档命令示例可验证 | `pnpm docs:validate` 的 shell 命令策略校验 |
| 功能变更文档影响评审 | `.github/pull_request_template.md` 的 docs impact 清单与 no-doc-impact 理由要求 |
