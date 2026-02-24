#!/usr/bin/env bash
# webadmin.sh — Manage htpasswd users for OpenCode Web Server
# Usage: ./scripts/webadmin.sh <command> [username]
#
# Commands:
#   add    <username>   Add a new user (prompts for password)
#   delete <username>   Remove a user
#   passwd <username>   Change password for an existing user
#   list               List all usernames

set -euo pipefail

HTPASSWD="${OPENCODE_SERVER_HTPASSWD:-$HOME/.config/opencode/.htpasswd}"

# Resolve bun binary
BUN="${BUN:-$(command -v bun 2>/dev/null || echo "$HOME/.bun/bin/bun")}"
if [[ ! -x "$BUN" ]]; then
  echo "Error: bun not found. Install bun or set BUN= path." >&2
  exit 1
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

ensure_file() {
  if [[ ! -f "$HTPASSWD" ]]; then
    mkdir -p "$(dirname "$HTPASSWD")"
    touch "$HTPASSWD"
    echo "Created $HTPASSWD"
  fi
}

user_exists() {
  grep -q "^${1}:" "$HTPASSWD" 2>/dev/null
}

read_password() {
  local pw1 pw2
  read -r -s -p "Password: " pw1; echo >&2
  if [[ -z "$pw1" ]]; then
    echo "Error: password cannot be empty." >&2
    return 1
  fi
  read -r -s -p "Confirm:  " pw2; echo >&2
  if [[ "$pw1" != "$pw2" ]]; then
    echo "Error: passwords do not match." >&2
    return 1
  fi
  echo "$pw1"
}

hash_password() {
  # Pass password via stdin to avoid shell history / ps exposure
  echo -n "$1" | "$BUN" -e '
    const pw = await new Response(Bun.stdin.stream()).text()
    console.log(await Bun.password.hash(pw, { algorithm: "argon2id" }))
  '
}

# ── Commands ─────────────────────────────────────────────────────────────────

cmd_add() {
  local user="$1"
  ensure_file
  if user_exists "$user"; then
    echo "Error: user '$user' already exists. Use 'passwd' to change password." >&2
    exit 1
  fi
  local pass
  pass=$(read_password) || exit 1
  local hash
  hash=$(hash_password "$pass")
  echo "${user}:${hash}" >> "$HTPASSWD"
  echo "Added user '$user'."
}

cmd_delete() {
  local user="$1"
  if [[ ! -f "$HTPASSWD" ]]; then
    echo "Error: htpasswd file not found at $HTPASSWD" >&2
    exit 1
  fi
  if ! user_exists "$user"; then
    echo "Error: user '$user' not found." >&2
    exit 1
  fi
  local tmp="${HTPASSWD}.tmp"
  grep -v "^${user}:" "$HTPASSWD" > "$tmp"
  mv "$tmp" "$HTPASSWD"
  echo "Deleted user '$user'."
}

cmd_passwd() {
  local user="$1"
  if [[ ! -f "$HTPASSWD" ]]; then
    echo "Error: htpasswd file not found at $HTPASSWD" >&2
    exit 1
  fi
  if ! user_exists "$user"; then
    echo "Error: user '$user' not found." >&2
    exit 1
  fi
  local pass
  pass=$(read_password) || exit 1
  local hash
  hash=$(hash_password "$pass")
  local tmp="${HTPASSWD}.tmp"
  sed "s|^${user}:.*|${user}:${hash}|" "$HTPASSWD" > "$tmp"
  mv "$tmp" "$HTPASSWD"
  echo "Password updated for '$user'."
}

cmd_list() {
  if [[ ! -f "$HTPASSWD" ]]; then
    echo "(no htpasswd file at $HTPASSWD)"
    return
  fi
  local count=0
  while IFS=: read -r user _hash; do
    [[ -z "$user" || "$user" == \#* ]] && continue
    echo "  $user"
    count=$((count + 1))
  done < "$HTPASSWD"
  echo "($count user(s) in $HTPASSWD)"
}

# ── Main ─────────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 <command> [username]"
  echo ""
  echo "Commands:"
  echo "  add    <username>   Add a new user"
  echo "  delete <username>   Remove a user"
  echo "  passwd <username>   Change password"
  echo "  list               List all usernames"
  echo ""
  echo "Htpasswd file: $HTPASSWD"
}

CMD="${1:-}"
case "$CMD" in
  add|delete|passwd)
    if [[ -z "${2:-}" ]]; then
      echo "Error: username required for '$CMD'." >&2
      usage >&2
      exit 1
    fi
    "cmd_$CMD" "$2"
    ;;
  list)
    cmd_list
    ;;
  *)
    usage
    exit 1
    ;;
esac
