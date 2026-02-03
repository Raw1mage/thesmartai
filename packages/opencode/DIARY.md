# DIARY

## 2026-02-03

### CHANGELOG

- Added session monitor snapshot with `/session/top` and SDK typings.
- Sidebar monitor now tracks current session + descendants only, updates every 2s, and hides completed tasks.
- Removed redundant Subagents panel from sidebar.
- Default session titles now use timestamp-only format.
- Read tool now suggests paths when parent directory is missing to avoid noisy ENOENT errors.
