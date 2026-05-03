#!/usr/bin/env bash
# beta/provider-account-decoupling — XDG isolation
# Source this BEFORE running any opencode command in this worktree.
# Memory: feedback_beta_xdg_isolation.md (2026-04-18 incident).

export BETA_ROOT="/home/pkcs12/projects/opencode-beta"
export XDG_CONFIG_HOME="$BETA_ROOT/.beta-env/xdg-config"
export XDG_DATA_HOME="$BETA_ROOT/.beta-env/xdg-data"
export XDG_STATE_HOME="$BETA_ROOT/.beta-env/xdg-state"
export XDG_CACHE_HOME="$BETA_ROOT/.beta-env/xdg-cache"
export OPENCODE_DATA_HOME="$BETA_ROOT/.beta-env/opencode-data"

mkdir -p "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME" "$XDG_CACHE_HOME" "$OPENCODE_DATA_HOME"

# Sanity check: refuse to run if any path resolves to main XDG
for v in XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_CACHE_HOME OPENCODE_DATA_HOME; do
  val="${!v}"
  case "$val" in
    /home/pkcs12/.config/opencode|/home/pkcs12/.local/share/opencode|/home/pkcs12/.local/state/opencode|/home/pkcs12/.cache/opencode)
      echo "FATAL: $v=$val collides with main XDG. Refusing to activate." >&2
      return 1
      ;;
  esac
done

echo "[beta-env] active. XDG_DATA_HOME=$XDG_DATA_HOME"
