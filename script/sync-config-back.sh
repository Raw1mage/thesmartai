#!/bin/bash

# 定義路徑
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$PROJECT_ROOT/templates"
USER_CONFIG_DIR="$HOME/.config/opencode"

echo "[Dev Sync Back] Synchronizing User Config -> Project Templates..."
echo "Source: $USER_CONFIG_DIR"
echo "Target: $TEMPLATE_DIR"

# 1. 反向同步 System Prompt (AGENTS.md)
if [ -f "$USER_CONFIG_DIR/AGENTS.md" ]; then
    if [ "$USER_CONFIG_DIR/AGENTS.md" -nt "$TEMPLATE_DIR/AGENTS.md" ]; then
        cp "$USER_CONFIG_DIR/AGENTS.md" "$TEMPLATE_DIR/AGENTS.md"
        echo "  -> Updated: templates/AGENTS.md (User version is newer)"
    else
        echo "  -> Skipped: templates/AGENTS.md (Repo version is current or newer)"
    fi
fi

# 2. 反向同步 Core Skills
# 只同步核心開發相關的 skill，避免污染 Repo
CORE_SKILLS=("agent-workflow" "model-selector")

for SKILL in "${CORE_SKILLS[@]}"; do
    SRC="$USER_CONFIG_DIR/skills/$SKILL"
    DEST="$TEMPLATE_DIR/skills/$SKILL"
    
    if [ -d "$SRC" ]; then
        # Check if any file in SRC is newer than DEST
        # Simplified: Check if SKILL.md is newer
        if [ "$SRC/SKILL.md" -nt "$DEST/SKILL.md" ]; then
            # 移除舊版 (確保刪除多餘檔案)
            rm -rf "$DEST"
            # 複製新版
            cp -r "$SRC" "$DEST"
            echo "  -> Updated: templates/skills/$SKILL (User version is newer)"
        else
            echo "  -> Skipped: templates/skills/$SKILL (Repo version is current or newer)"
        fi
    else
        echo "  -> Warning: User skill '$SKILL' not found in config."
    fi
done

echo "[Dev Sync Back] Complete. Please check 'git status' and commit changes."
