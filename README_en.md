<div align="center">

<img src="./assets/logo.png" width="160" alt="Neko logo — a pixel-art blue-haired catgirl maid">

# dsh-catgirl-plugin

**A token-efficient persona runtime for DeepSeek Harness.**

Keep personality in the interface, intelligence in the model.

**[简体中文](README.md) | English**

</div>

<p align="center">
  <img src="./assets/readme/hero.jpg" width="100%" alt="dsh-catgirl-plugin — a token-efficient catgirl persona runtime for DeepSeek Harness: -67% new input on the first request, -66% cache reads in steady state, catgirl flavor rendered locally at zero LLM token cost">
</p>

## Example

> User: write me a sorting algorithm
>
> Model (normal output): Wrote `/tmp/qs.py`: in-place quicksort, all 6 test cases PASS.
>
> **What you see**: Wrote `/tmp/qs.py`: in-place quicksort, all 6 test cases PASS. **喵~ (｡･ω･｡)**

## Core idea

The traditional approach makes the LLM "act catgirl" itself: a few hundred tokens of persona injected into the system prompt, paid again on every request, and the model's output gets wordier.

This plugin does the opposite — **persona virtualization**:

<p align="center">
  <img src="./assets/readme/mechanism.svg" width="100%" alt="Persona virtualization: the model answers normally with a 6-token persona, the session log stores raw text, and a local render layer adds the catgirl flavor at zero LLM token cost">
</p>

- **The session log stores raw text** — zero pollution of the model's context
- **Catgirl flavor at 0 LLM tokens** — all rendered locally
- **Tool schema trimming**: 25 → 8 tools, saving thousands of tokens per request

## Measured results

Real DeepSeek API (2026-08-14): **-67% new input on the first request, -66% cache reads in steady state, no quality degradation**.

<details>
<summary>Full comparison data (same task: write quicksort + save + run)</summary>

### Cold start (first agent request, no cache)

| Config | First request new input | Total new input | Total cache reads | Output |
|---|---|---|---|---|
| Baseline (no plugin) | 12,372 | 12,520 | 25,856 | 838 |
| Traditional catgirl | 12,576 | 13,156 | 26,240 | 860 |
| **Lite + Economy** | **3,881** | **4,178** | **8,960** | 739 |

### Steady state (second run, cache warm)

| Config | New input | Cache reads |
|---|---|---|
| Baseline | 497 | 38,144 |
| **Lite + Economy** | 386 | **12,800** (-66%) |

### Findings

1. A traditional long-persona catgirl costs **more** tokens (+5%) — persona is a per-request recurring cost
2. A minimal persona ≈ baseline — its value is letting the model output normal text, leaving the catgirl flavor to local rendering
3. **Tool schema trimming is the real token saver** — `ctx.tools.restrict()` trims at the agent scope, keeping what the model sees aligned with what it can execute

</details>

## Quality comparison

5-task battery (coding / web search / file search / pure Q&A / subagent): **no quality degradation**; the model adapts to missing tools (curl instead of web_search, direct answers instead of subagents).

<details>
<summary>Full comparison data (baseline vs this plugin)</summary>

| Task | Tool status | Baseline quality | Plugin quality | Baseline tokens (new/cache) | Plugin tokens |
|---|---|---|---|---|---|
| Coding | kept | ✅ | ✅ (+edge cases) | 309 / 37,760 | 725 / 22,016 |
| Web search | **trimmed** | ✅ news data | ✅ live API (curl) | 2,476 / 65,408 | 1,403 / 17,024 |
| File search | kept | ✅ 215 files | ✅ 215 files | 7,066 / 40,832 | 3,490 / 22,912 |
| Pure Q&A | no tools | ✅ detailed | ✅ concise | 192 / 12,288 | 149 / 3,840 |
| Subagent | **trimmed** | ⚠️ truncated output | ✅ answered directly | 18,702 / 61,312 | 189 / 3,840 |

</details>

**The real boundary**: tasks that require a specialized tool (parallel subagents, skill calls) change strategy. Progressive disclosure solves this:

```text
Model: enable_tool("subagent") → tool unlocked
Model: subagent × 2 (parallel delegation) → subagents done → summary
```

Measured end-to-end: the model recognized the missing tool, called `enable_tool`, delegated to two parallel subagents, and summarized correctly. **Capability fully restored**, while the parent's tool schemas stay minimal until escalation (~2,000 tokens/request saved).

If a requested tool is not installed in the current profile, `enable_tool` reports it as unavailable and preserves the previous allow-list, so the session can continue unlocking other tools.

## Quick start

```sh
# Install from npm
dsh plugin --profile demo add dsh-catgirl-plugin
```

Then add to the profile patch:

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

Web UI rendering (optional): install `dsh-catgirl-plugin-client` and add it to the profile patch:

```yaml
- insert:
    - id: neko-renderer-client
      name: dsh-catgirl-plugin-client
```

## Plugin family

| Plugin | Role | Token impact |
|---|---|---|
| `catgirl-lite.js` | minimal persona (6 tokens) | +6 per request |
| `neko-renderer.js` | headless display decoration | 0 |
| `catgirl-economy.js` | tool trimming + `enable_tool` on-demand unlock | **-8,491 per request (-69%)** |
| `client/` | Web UI rendering (shadows the assistant renderer) | 0 |
| `index.js` | traditional long persona (for comparison) | +hundreds per request |
| `usage-meter.js` | dev tool: records usage | 0 |

## Tool profiles

| `profile` | Initial tools | Use case |
|---|---|---|
| `coding` | editing, files, search, and todo | Default for development work |
| `normal` | reading, search, and Web | Research and general assistance |
| `chat` | no global tools | Conversation; unlock tools with `enable_tool` when needed |

When set, `allow` overrides the profile, including an explicit empty list. Use `escalatable` to control which tools may be unlocked on demand. Tools missing from the active DSH profile are filtered at startup instead of crashing agent creation.

## Future direction

- Add a Reasoning Router only after establishing cross-model quality baselines
- Predict a tool profile by task while retaining explicit configuration as the fallback
- Map the agent lifecycle to a richer Web UI state

## Known Limitations

- **Headless one-shot does not wait for background subagents**: `run_in_background: true` children are killed on parent exit (headless app limitation, not the plugin; sync mode works)
- **`nya` tool output is random** (`Math.random()`), unsuitable for snapshot tests
- **Persona text is Chinese-only**: edit `INTENSITY_TEXT` in `index.js` or extend via `traits`

## Development

```sh
npm ci && npm test && npm run pack:check
npm ci --prefix client
npm run --prefix client typecheck
npm run --prefix client build
npm run --prefix client pack:check
```

Point the real Loader composition test at a built Harness checkout:

```sh
DSH_HARNESS_PATH=/path/to/deepseek-harness npm run test:composition
```

Quality runs write usage, output, overlay, and machine-readable metadata artifacts into one directory:

```sh
DSH_BIN=/path/to/dsh BENCHMARK_OUTPUT_DIR=/tmp/bench \
  npm run test:quality -- quicksort lite "write quicksort and run its tests"
```

The files under `overlays/` use npm package paths and contain no machine-specific absolute paths. Root and client packages stay on the same version. The Release workflow publishes both npm packages and creates a GitHub Release only when a `v*` tag is explicitly pushed. Configure the repository `NPM_TOKEN` secret before the first release.

## License

[MIT](LICENSE)
