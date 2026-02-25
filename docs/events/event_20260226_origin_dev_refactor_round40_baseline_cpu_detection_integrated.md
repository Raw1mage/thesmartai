# Event: origin/dev refactor round40 (baseline CPU detection)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Evaluate upstream baseline CPU detection fix for launcher/install paths.

## 2) Candidate

- Upstream commit: `4018c863e3b4b9857fe9378ae54e406a5cf5ab48`
- Subject: `fix: baseline CPU detection`

## 3) Decision + rationale

- Decision: **Integrated**
- Rationale:
  - Current cms root launcher `bin/opencode` already contains AVX2/baseline detection logic across Linux/macOS/Windows and fallback package-name ordering.
  - Upstream behavior intent is already covered locally.

## 4) File scope reviewed

- `bin/opencode`
- `install` (context)

## 5) Validation plan / result

- Validation method: script-level parity inspection for AVX2 + baseline fallback resolution.
- Result: integrated-equivalent; no code change required.

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before decision.
- No architecture change applied.
