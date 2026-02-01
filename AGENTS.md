- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.
- Bun is installed at `/home/pkcs12/.bun/bin/bun`.

## Style Guide

- Keep things in one function unless composable or reusable
- Avoid unnecessary destructuring. Instead of `const { a, b } = obj`, use `obj.a` and `obj.b` to preserve context
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity

### Avoid let statements

We don't like `let` statements, especially combined with if/else statements.
Prefer `const`.

Good:

```ts
const foo = condition ? 1 : 2
```

Bad:

```ts
let foo

if (condition) foo = 1
else foo = 2
```

### Avoid else statements

Prefer early returns or using an `iife` to avoid else statements.

Good:

```ts
function foo() {
  if (condition) return 1
  return 2
}
```

Bad:

```ts
function foo() {
  if (condition) return 1
  else return 2
}
```

### Prefer single word naming

Try your best to find a single word name for your variables, functions, etc.
Only use multiple words if you cannot.

Good:

```ts
const foo = 1
const bar = 2
const baz = 3
```

Bad:

```ts
const fooBar = 1
const barBaz = 2
const bazFoo = 3
```

## Testing

You MUST avoid using `mocks` as much as possible.
Tests MUST test actual implementation, do not duplicate logic into a test.

---

## Agent/Subagent Model Selection Policy

Agents and subagents should select models from **Favorites** as the primary pool for automatic rotation. The model selection considers both availability (rate limits) and cost efficiency based on billing type.

### Billing Model Types

| Type                  | Calculation         | Best For                                         | Examples                          |
| --------------------- | ------------------- | ------------------------------------------------ | --------------------------------- |
| **Token-based**       | Per-token usage     | Trivial/small tasks (low token count = low cost) | OpenAI API (`gpt-5.1-codex-mini`) |
| **Subscription**      | Per-request quota   | Large/complex tasks (more value per message)     | ChatGPT Plus, OpenCode            |
| **Work-based**        | Per-task complexity | Trivial tasks (simple = low quota burn)          | Antigravity (Google AI Pro/Ultra) |
| **Quota-based (RPD)** | Per-request limit   | Moderate/Complex tasks (preserve daily limit)    | Google API (Free Tier)            |

> ⚠️ **RPD 計次型計費**: Google API Free Tier 每個 request 消耗 1 RPD，不論 token 多少。一句話和一整頁的 prompt 消耗相同。**不應用於瑣碎任務**。
>
> **Note on Antigravity**: Charges by "work done". Ideal for quick fixes.
>
> **Note on Anthropic**: Temporarily PAUSED due to policy restrictions on third-party subscription reuse.

### Available Models

#### OpenAI (Current Options)

| Model | Billing | Best For |
|-------|---------|----------|
| `gpt-5.2-codex` | subscription | Latest frontier agentic coding |
| `gpt-5.2` | subscription | Latest frontier model |
| `gpt-5.1-codex-max` | subscription | Deep and fast reasoning |
| `gpt-5.1-codex-mini` | **token** | **Trivial tasks (PRIMARY)** - cheap, fast |

#### Google API Free Tier (RPD 計次型)

| Model | RPM | TPM | RPD | 適用場景 |
|-------|-----|-----|-----|----------|
| Gemini 2.5 Flash-Lite | 15 | 250K | **1,000** | 中等任務 |
| Gemini 2.5 Flash | 10 | 250K | 250 | 一般開發 |
| Gemini 2.5 Pro | 5 | 250K | 100 | 複雜推理 |
| Gemini 3 Pro Preview | 10 | 250K | 100 | 最新功能 |

> ⚠️ **不要用 Google API 做瑣碎任務！**
> - ❌ Title generation, summaries, yes/no → 用 `gpt-5.1-codex-mini`
> - ❌ Host/Orchestrator 互動 → 用 `gpt-5.1-codex-mini`
> - ✅ Coding, review, planning → 可以用 Google API

#### Antigravity (Work-based)

| Tier | Reset | Best For |
|------|-------|----------|
| Free | Weekly | Light usage |
| AI Pro ($20/mo) | 5 hours | Regular usage |
| AI Ultra ($250/mo) | 5 hours | Heavy usage |

Models: Gemini 3 Pro/Flash, Claude Opus 4.5, Claude Sonnet 4.5, GPT-OSS 120B

### Task-to-Model Matching

```yaml
task_billing_policy:
  trivial:
    description: "Host/Orchestrator, title, summaries, simple edits"
    preferred_billing: token-based
    model: "gpt-5.1-codex-mini"
    reason: "Low cost, does NOT consume Google RPD"

  moderate:
    description: "Code review, documentation, moderate edits"
    preferred_billing: any
    models: [gpt-5.2-codex, gemini-2.5-flash]

  complex:
    description: "Architecture, refactoring, multi-file changes"
    preferred_billing: subscription
    models: [gpt-5.2-codex, gpt-5.2, gemini-2.5-pro]
```

### Provider Priority

**Complex tasks** (high token count):
1. Subscription: `opencode`, `openai-oauth`, `github-copilot`
2. High-quota: `gemini-cli`
3. API fallback: `openai-api`, `google-api` (Pro/Flash)

**Trivial tasks** (high frequency):
1. **Token-based: `gpt-5.1-codex-mini`** ← PRIMARY
2. Work-based: `antigravity`
3. DO NOT use Google API (wastes RPD)

### Subagent Policies

```yaml
subagent_policies:
  host:
    description: "Orchestrator, user interaction"
    model: "gpt-5.1-codex-mini"
    billing: token-based

  explore:
    description: "Codebase exploration"
    model: "gpt-5.1-codex-mini"
    billing: token-based

  plan:
    description: "Architecture planning"
    models: [gpt-5.2-codex, gemini-2.5-pro]
    billing: subscription

  bash:
    description: "Command execution"
    model: "gpt-5.1-codex-mini"
    billing: token-based

  general:
    description: "Multi-step tasks"
    models: [gpt-5.2-codex, gpt-5.2]
    billing: subscription
```

### Rate Limit Recovery

| Reason | Backoff |
|--------|---------|
| `QUOTA_EXHAUSTED` | 1m → 5m → 30m → 2h |
| `RATE_LIMIT_EXCEEDED` | 30s |
| `MODEL_CAPACITY_EXHAUSTED` | 45s ± 15s |
| `SERVER_ERROR` | 20s |

### Fallback Chains

```yaml
fallback:
  gpt-5.2-codex: [gpt-5.2, gpt-5.1-codex-max, gemini-2.5-pro]
  gpt-5.2: [gpt-5.2-codex, gemini-2.5-pro]
  gemini-2.5-pro: [gpt-5.2-codex, gemini-2.5-flash]
  gpt-5.1-codex-mini: [gemini-2.5-flash-lite]  # Last resort only
```
