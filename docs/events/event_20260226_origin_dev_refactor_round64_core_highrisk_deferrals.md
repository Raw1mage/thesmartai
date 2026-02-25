# Event: origin/dev refactor round64 (core high-risk deferrals)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Triage remaining core-surface commits that touch provider/CLI/TUI high-risk paths and defer them for dedicated focused rounds.

## 2) Candidate(s)

- Provider surface:
  - `0d90a22f9057dd69dca65ab52450f17d47a8656e`
  - `afd0716cbdca5191b6c45dbc8325c6f9e658715f`
  - `f7708efa5b87ae292c973d3fb409d060b5ed8f56`
  - `1d041c8861cdeb72fa2f31020991860a2cde8c28`
- CLI/TUI surface:
  - `5cc1d6097e02e2f157b7ae68de9e5df06531b53d`
  - `16332a858396c23c1bf6fa673964ae306d5414ab`
  - `bb30e06855fb979b5fd765796a6b7428b9177b91`
- SQLite/command surface:
  - `fdad823edc13fbc8fbaf4bf54eae53b1286ee2e9`
  - `b0afdf6ea4c016c46762b649adc30c0456814a43`

## 3) Decision + rationale

- Decision: **Skipped** (all, deferred)
- Rationale:
  - These commits touch high-volatility core surfaces and require dedicated focused validation to avoid regression in cms diverged architecture.
  - Current pass prioritizes low-risk throughput and clear behavioral ports.

## 4) File scope reviewed

- `packages/opencode/src/provider/**`
- `packages/opencode/src/cli/cmd/tui/**`
- `packages/opencode/src/cli/cmd/**`

## 5) Validation plan / result

- Validation method: risk classification by surface volatility and divergence.
- Result: skipped for this throughput batch; queued for dedicated follow-up stream.

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before decision.
- No architecture change applied.
