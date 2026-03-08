# Evolve Agent / Capability Broker (Draft)

Date: 2026-03-08
Status: Draft

## Goal

Design an agent that can continuously expand its own capabilities by:

1. inspecting current local capabilities,
2. detecting missing capabilities for a task,
3. searching external skill/MCP markets,
4. installing/configuring approved candidates,
5. activating them on demand,
6. feeding the new capability back into future routing.

## Problem Statement

Current OpenCode already has three useful pieces, but they are not yet unified:

- `enablement.json` provides a local capability inventory.
- `resolve-tools.ts` provides limited on-demand MCP activation.
- `mcp-finder` / `skill-finder` provide manual or semi-manual expansion workflows.

What is missing is a single runtime broker that can turn these into a self-expanding system.

## Core Design Principle

Do **not** make the router itself another MCP first.

Preferred architecture:

- **Registry**: declarative local inventory and policy
- **Broker/Router**: deterministic runtime decision logic in-process
- **Installer**: market search / evaluation / install / config pipeline
- **Activator**: connect/disconnect lifecycle manager

This keeps core routing reliable and debuggable while still allowing market-driven extension.

## Proposed Architecture

### 1. Capability Registry

Primary file:

- `packages/opencode/src/session/prompt/enablement.json`

Future expansion fields:

- `capability_id`
- `kind`: `tool | skill | mcp | agent`
- `source`: `builtin | local-installed | market-installed`
- `mode`: `resident | on-demand | manual`
- `keywords`
- `task_patterns`
- `requires_auth`
- `approval_policy`
- `startup_cost`
- `idle_timeout_ms`
- `fallbacks`
- `conflicts_with`

### 2. Capability Broker

New runtime module concept:

- `packages/opencode/src/capability/broker.ts`

Responsibilities:

1. inspect current capabilities,
2. match task intent to existing local capabilities,
3. decide whether local capability is sufficient,
4. if not sufficient, invoke finder/market workflow,
5. request approval for install/auth when needed,
6. activate capability and return tool surface to the session.

### 3. Market Adapters

Separate adapters for external discovery:

- MCP market adapter
- Skill marketplace / GitHub adapter
- optional curated internal registry adapter

Responsibilities:

- search
- metadata normalization
- trust/risk scoring
- install instructions
- auth requirement detection

### 4. Installer / Provisioner

Use existing concepts behind `mcp-finder` and `skill-finder`, but productize them as reusable runtime services.

Responsibilities:

- write config safely
- add MCP/skill entries
- preserve existing config sections
- insert placeholders for secrets
- validate install
- refresh capability registry

### 5. Activation Lifecycle

Activation should stay in-process, not market-driven.

Rules:

- resident capabilities connect at startup
- on-demand capabilities connect on concrete need
- idle capabilities disconnect after timeout
- failed capabilities enter cooldown / degraded state

## Decision Flow

```text
Task arrives
  -> inspect local registry
  -> match local capabilities
  -> enough? yes -> activate/use existing capability
  -> enough? no -> search market adapters
  -> rank candidates
  -> require user approval if install/auth/risk threshold exceeded
  -> install/configure
  -> refresh registry
  -> activate capability
  -> execute task
```

## Approval Model

Default policy should be conservative.

### Auto-allowed

- connect existing local MCP already configured
- load existing local skill already installed

### Ask-user required

- install new MCP
- install new skill
- write secrets/auth values
- enable networked remote MCP with external data access
- broaden filesystem scope

## Trust Model

Every market candidate should carry normalized metadata:

- publisher / repo / package
- version
- transport type
- requested secrets
- runtime permissions
- maintenance health
- verification status

Candidates should be ranked by:

1. verified/curated source,
2. low secret surface,
3. narrow permissions,
4. local execution compatibility,
5. clear docs and validation path.

## Phased Delivery

### Phase 1 — Broker foundation

- keep `enablement.json` as SSOT
- extract current on-demand MCP routing into dedicated broker module
- add explicit capability metadata fields

### Phase 2 — Managed local arsenal

- support large configured MCP inventory
- classify resident vs on-demand vs manual
- expose broker decisions in logs / UI

### Phase 3 — Market-assisted expansion

- broker can call MCP/skill finder adapters
- support install proposal + approval flow
- update registry after install

### Phase 4 — Continuous evolution

- learn from repeated unmet intents
- suggest durable installs proactively
- maintain health/trust scores over time

## Initial Recommendation

Start with:

1. formalizing a richer `enablement.json` schema,
2. extracting a dedicated `CapabilityBroker` module,
3. making current MCP arsenal explicitly tiered (`resident/on-demand/manual`),
4. integrating `mcp-finder` / `skill-finder` as broker-controlled install actions.

Avoid building a separate routing MCP until the in-process broker becomes a proven bottleneck.
