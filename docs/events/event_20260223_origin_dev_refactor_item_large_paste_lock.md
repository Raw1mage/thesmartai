# Event: origin/dev refactor item - prompt large-paste lock prevention

Date: 2026-02-23
Status: Integrated (no code delta)

## Source

- `7e681b0bc` fix(app): large text pasted into prompt-input causes main thread lock

## Result

- After inspection, the key behavior from upstream is already present on `cms`:
  - non-empty prompt detection optimized via `NON_EMPTY_TEXT`
  - guarded/returning `addPart` insertion path
  - large-paste detection thresholds in `attachments.ts`
  - newline-heavy fragment guard in `editor-dom.ts` (`MAX_BREAKS`)

## Validation

- Attempted focused test:
  - `bun test /home/pkcs12/projects/opencode/packages/app/src/components/prompt-input/editor-dom.test.ts`
- Output: fails because DOM globals are not available in this direct test invocation (`document is not defined`), indicating environment setup requirement rather than behavior regression.
