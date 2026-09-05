<div align="center">

<img src="./assets/logo.png" width="160" alt="Neko logo — 像素风蓝发猫娘女仆">

# dsh-catgirl-plugin

**一个为 DeepSeek Harness 打造的 token 高效人格运行时。**

把人格留在界面，把智能留给模型。

**简体中文 | [English](README_en.md)**

</div>

<p align="center">
  <img src="./assets/readme/hero.jpg" width="100%" alt="dsh-catgirl-plugin — 为 DeepSeek Harness 打造的 token 高效猫娘人格运行时：首个请求新输入 -67%，稳态缓存命中 -66%，猫娘风味本地渲染、0 LLM token 成本">
</p>

## 效果示例

> 用户：帮我写个排序算法
>
> 模型（正常输出）：已写入 `/tmp/qs.py`：原地分区版快速排序，6 组测试全部 PASS。
>
> **你看到的**：已写入 `/tmp/qs.py`：原地分区版快速排序，6 组测试全部 PASS。**喵~ (｡･ω･｡)**

## 核心思想

传统做法让 LLM 自己"演猫娘"：几百 token 的长 persona 注入 system prompt，每个请求重复付费，模型输出还变啰嗦。

本插件反其道而行——**Persona Virtualization**：

<p align="center">
  <img src="./assets/readme/mechanism.svg" width="100%" alt="Persona Virtualization：模型以 6-token persona 正常回答，会话日志保存原文，本地渲染层以 0 LLM token 成本添加猫娘风味">
</p>

- **会话日志保存原文**，模型上下文零污染
- **猫娘风味 0 LLM Token**，全部本地渲染
- **工具 schema 裁剪**：25 → 8 个，省下每请求数千 token

## 实测结果

真实 DeepSeek API 实测（2026-08-14）：**首个请求新输入 -67%，稳态缓存命中 -66%，质量无退化**。

<details>
<summary>完整对比数据（同一任务：写快速排序 + 保存 + 运行验证）</summary>

### 冷启动（首个 agent 请求，无缓存）

| 配置 | 首个请求新输入 | 全程新输入 | 全程缓存命中 | 输出 |
|---|---|---|---|---|
| 基线（无插件） | 12,372 | 12,520 | 25,856 | 838 |
| 传统猫娘 | 12,576 | 13,156 | 26,240 | 860 |
| **Lite + Economy** | **3,881** | **4,178** | **8,960** | 739 |

### 稳态（第二次运行，缓存已建立）

| 配置 | 新输入 | 缓存命中 |
|---|---|---|
| 基线 | 497 | 38,144 |
| **Lite + Economy** | 386 | **12,800**（-66%） |

### 结论

1. 传统长 persona 猫娘**更费** token（+5%）——persona 是 per-request 重复成本
2. 极短 persona ≈ 基线——它的价值是让模型输出正常文本，把猫娘风味让给本地渲染
3. **工具 schema 裁剪才是省 token 引擎**——`ctx.tools.restrict()` 在 agent 作用域裁剪，模型看到的与可执行的保持一致

</details>

## 质量对比

5 类任务实测（编码 / Web 搜索 / 文件搜索 / 纯问答 / Subagent）：**质量无退化**，模型自适应（web 任务用 `curl` 绕过、subagent 任务直接回答）。

<details>
<summary>完整对比数据（基线 vs 本插件）</summary>

| 任务 | 工具状态 | 基线质量 | 插件质量 | 基线 token（新输入/缓存） | 插件 token |
|---|---|---|---|---|---|
| 编码 | 保留 | ✅ | ✅（+边界处理） | 309 / 37,760 | 725 / 22,016 |
| Web 搜索 | **被裁** | ✅ 新闻数据 | ✅ 实时 API（curl） | 2,476 / 65,408 | 1,403 / 17,024 |
| 文件搜索 | 保留 | ✅ 215 个 | ✅ 215 个 | 7,066 / 40,832 | 3,490 / 22,912 |
| 纯问答 | 无工具 | ✅ 详细 | ✅ 简洁 | 192 / 12,288 | 149 / 3,840 |
| Subagent | **被裁** | ⚠️ 输出截断 | ✅ 直接回答 | 18,702 / 61,312 | 189 / 3,840 |

</details>

**退化边界**：需要专用工具的任务（subagent 并行、skill 调用）——模型会改变策略。`enable_tool` 渐进式披露解决：

```text
模型：enable_tool("subagent") → 工具已解锁
模型：subagent × 2（并行委派）→ 子代理完成 → 汇总
```

实测：模型识别到 subagent 缺失 → 调用 `enable_tool` → 并行派发两个子代理 → 正确汇总。**能力完整恢复**，父 agent 的工具 schema 在解锁前保持最小（省 ~2,000 token/请求）。

如果请求解锁的工具未安装在当前 profile，`enable_tool` 会返回不可用提示并保留原白名单，会话可以继续正常解锁其他工具。

## 快速开始

```sh
# 从 npm 下载安装
dsh plugin --profile demo add dsh-catgirl-plugin
```

然后加入 profile patch：

```yaml
- insert:
    - id: catgirl-lite
      name: dsh-catgirl-plugin/catgirl-lite
      config:
        persona: 'Be concise, friendly, and natural.'
    - id: neko-renderer
      name: dsh-catgirl-plugin/neko-renderer
    - id: catgirl-economy
      name: dsh-catgirl-plugin/catgirl-economy
      config:
        profile: coding
```

Web UI 渲染（可选）：安装 `dsh-catgirl-plugin-client` 并加入 profile patch：

```yaml
- insert:
    - id: neko-renderer-client
      name: dsh-catgirl-plugin-client
```

## 插件家族

| 插件 | 作用 | Token 影响 |
|---|---|---|
| `catgirl-lite.js` | 极短 persona（6 token） | 每请求 +6 |
| `neko-renderer.js` | headless 显示层喵化 | 0 |
| `catgirl-economy.js` | 工具裁剪 + `enable_tool` 按需解锁 | **每请求 -8,491（-69%）** |
| `client/` | Web UI 渲染（shadow assistant 渲染器） | 0 |
| `index.js` | 传统长 persona（对比用） | 每请求 +数百 |
| `usage-meter.js` | 开发工具：usage 记录 | 0 |

## 工具档位

| `profile` | 初始工具 | 用途 |
|---|---|---|
| `coding` | 编辑、文件、搜索和 todo | 默认，适合开发任务 |
| `normal` | 读取、搜索和 Web | 调研与日常助手 |
| `chat` | 无全局工具 | 纯对话，需要时通过 `enable_tool` 解锁 |

`allow` 设置后会覆盖档位，包括显式空列表；`escalatable` 可自定义允许按需解锁的工具。插件会过滤当前 profile 中未安装的初始工具，避免启动失败。

## 后续方向

- Reasoning Router 需要先建立跨模型质量基线，不默认自动开启
- 按任务类型预判工具档位，保留显式配置作为回退
- 把 agent 生命周期映射为更完整的 Web UI 状态

## 已知限制

- **headless 一次性进程不等待后台 subagent**：`run_in_background: true` 的子代理在父进程退出时被终止（headless 应用限制，Web UI 无此问题）；同步模式完整可用
- **`nya` 工具输出随机**（`Math.random()`），不适合快照测试
- **人设文案为中文单语**：`INTENSITY_TEXT` 在 `index.js`，可自行修改或通过 `traits` 扩展

## 开发

```sh
npm ci && npm test && npm run pack:check
npm ci --prefix client
npm run --prefix client typecheck
npm run --prefix client build
npm run --prefix client pack:check
```

真实 Loader 组合测试通过环境变量指向已构建的 Harness：

```sh
DSH_HARNESS_PATH=/path/to/deepseek-harness npm run test:composition
```

质量实验会将 usage、输出、overlay 和机器可读元数据写入同一目录：

```sh
DSH_BIN=/path/to/dsh BENCHMARK_OUTPUT_DIR=/tmp/bench \
  npm run test:quality -- quicksort lite "写快速排序并运行测试"
```

`overlays/` 使用 npm 包路径，不包含个人机器绝对路径。根包与客户端保持同版本；显式推送 `v*` tag 时，Release workflow 才会发布 npm 包并创建 GitHub Release。首次发布前需在仓库中配置 `NPM_TOKEN` Secret。

## License

[MIT](LICENSE)
