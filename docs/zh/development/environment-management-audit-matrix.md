# 环境管理审计矩阵

这份矩阵是环境管理链路的回归基线。
它定义了 capability map、verification matrix，以及
`improve-environment-management-completeness-and-tests`
这次 OpenSpec 变更要执行的 90% 覆盖率目标范围。

说明：
- 目标不是只看单文件覆盖率，而是看整条环境管理链路是否被持续验证。
- `lib/tauri.ts` 继续主要通过 invoke 契约测试来保护，而不是直接纳入 coverage threshold。
- 下表按模块层级列出职责与必须稳定的关键不变量。

## Capability Map

| 模块分组 | 主要文件 | 职责 | 关键不变量 |
|---|---|---|---|
| Rust 环境核心 | `src-tauri/src/core/environment.rs` | 统一环境列表/读取/安装/检测编排与 provider 解析 | logical env type 归一规则稳定；provider-aware 行不会被错误合并；变更后的验证结果语义稳定 |
| Rust 项目检测 | `src-tauri/src/core/project_env_detect.rs` | 检测源顺序、解析逻辑、默认启用检测源 | detection source 顺序和默认启用集合以 backend 为权威，且优先级确定 |
| Rust Tauri commands | `src-tauri/src/commands/environment.rs` | 暴露环境列表、安装、卸载、检测、settings、providers、updates、cleanup 等 IPC 契约 | command 名、参数、返回结构稳定；成功变更后会做缓存失效 |
| TypeScript Tauri bridge | `lib/tauri.ts` | 前端 invoke wrapper 与 payload 组装 | wrapper 的命令名与 payload key 必须和 Rust command 严格对齐 |
| TS 共享类型 | `types/tauri.ts` | Rust 结果在前端的类型契约 | snake_case / camelCase 语义必须与 Rust 序列化规则一致 |
| 环境 store | `lib/stores/environment.ts` | env settings、provider 选择、workflow、筛选状态的持久化 | logical env settings key 解析一致；不同 provider 的同类环境不会互相覆盖 |
| 环境编排 hook | `hooks/use-environments.ts` | 拉取、stale-while-revalidate、in-flight 去重、变更后 reconcile、detection source fallback | 缓存行为可预测；变更后环境/检测/provider 状态同步一致 |
| 环境 workflow 帮助层 | `lib/environment-workflow.ts`、`hooks/use-environment-workflow.ts` | workflow 上下文、provider 连续性、blocked/running/success 状态 | workflow 上下文可跨页面延续；过期 provider 选择会被稳定归一 |
| 检测帮助层 | `lib/environment-detection.ts`、`hooks/use-environment-detection.ts` | 将检测结果映射回 UI 语义 | provider-aware 检测结果不会错绑到错误的环境 |
| 环境页面 | `app/environments/page.tsx`、`app/environments/[envType]/page.tsx` | overview 页面与 detail route 编排 | desktop fallback 明确；provider 选择与 project path 上下文连续 |
| 环境组件 | `components/environments/**/*.tsx` | cards、detail panels、version browser、profile manager、workflow banner、health/update 等 UI | 用户操作看到的 provider/settings/workflow 状态在不同 surface 间一致 |
| 测试矩阵 | `lib/*.test.ts`、`hooks/*.test.ts`、`app/environments/*.test.tsx`、`components/environments/*.test.tsx`、Rust 单测 | 为以上每层提供回归保护 | 每个模块分组至少有一条聚焦自动化断言 |

## Verification Matrix

| 模块分组 | 必须持续可用的关键行为 | 主要自动化验证 |
|---|---|---|
| Rust 环境核心 | provider-aware 列表行、版本验证语义、检测结果结构 | `src-tauri/src/core/environment.rs` 单测 |
| Rust 项目检测 | default detection sources、default-enabled set、source priority | `src-tauri/src/core/project_env_detect.rs` 单测 |
| Rust Tauri commands | `env_list`、`env_install`、`env_uninstall`、`env_detect_all`、`env_save_settings`、`env_load_settings`、detection source、provider list 等命令语义 | Rust command 侧测试；TS invoke 契约测试负责链路对齐 |
| TypeScript Tauri bridge | invoke 命令名与 payload key 不漂移 | `lib/tauri.test.ts` |
| TS 共享类型 | 前端消费的字段命名和类型不误读 Rust 序列化结果 | `lib/tauri.test.ts` + `hooks/use-environments.ts` 的编译期使用 |
| 环境 store | provider 选择持久化、logical env type 归一、settings key 迁移/覆盖、workflow 状态写入 | `lib/stores/environment.test.ts` |
| 环境编排 hook | in-flight 去重、detection source fallback、settings load/save 归一、reconcile/invalidation 一致性 | `hooks/use-environments.test.ts` |
| 环境 workflow 帮助层 | selected provider 连续性、workflow 状态复用、blocked-state 归一 | `lib/environment-workflow.test.ts`、`hooks/use-environment-workflow.test.ts` |
| 检测帮助层 | 检测结果映射回 env/provider surface 的正确性 | `lib/environment-detection.test.ts`、`hooks/use-environment-detection.test.ts` |
| 环境 overview route | desktop-only fallback、初始化拉取、provider 连续性、refresh wiring | `app/environments/page.test.tsx` |
| 环境 detail route | 选中 provider/environment 的 detail route 组合与回退行为 | `app/environments/[envType]/page.test.tsx` |
| 环境组件 | settings 保存链路、detail panel refresh、workflow banner、card action、profile 可见性、health/update 摘要 | `components/environments/**/*.test.tsx` |

## 覆盖率目标范围（90% 门槛）

环境管理专用 coverage gate 建议只统计这些生产文件：

- `app/environments/**/*.{ts,tsx}`
- `components/environments/**/*.{ts,tsx}`
- `hooks/use-environments.ts`
- `hooks/use-environment-detection.ts`
- `hooks/use-environment-workflow.ts`
- `lib/stores/environment.ts`
- `lib/environment-detection.ts`
- `lib/environment-workflow.ts`

明确排除项：

- `lib/tauri.ts`
  原因：它的主要风险是 IPC 契约漂移，适合用 invoke contract tests 保护，而不是直接靠 line coverage。
- 测试文件、`*.d.ts`、纯 barrel 的 `index.ts`
  原因：它们不代表需要被门槛直接约束的生产行为。

## 本次变更的优先补齐点

1. `lib/tauri.test.ts` 中环境管理 IPC 契约覆盖不足
2. `lib/stores/environment.test.ts` 中 provider 选择与 logical env type 边界不足
3. `hooks/use-environments.test.ts` 中 reconcile / detection source fallback 边界不足
4. `app/environments/*.test.tsx` 中 provider continuity 与 desktop fallback 断言不足
5. CI 中缺少 `cargo test --manifest-path src-tauri/Cargo.toml` 的持续校验

