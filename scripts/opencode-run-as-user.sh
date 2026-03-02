#!/usr/bin/env bash

set -euo pipefail

err() {
  printf '[opencode-run-as-user] %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  opencode-run-as-user --user <linux-user> --cwd <absolute-dir> [--env KEY=VALUE ...] -- <command> [args...]
EOF
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    err "must run as root (expected via sudoers bridge)"
  fi
}

valid_user() {
  [[ "$1" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]]
}

valid_env_key() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

require_root

target_user=""
target_cwd=""
declare -a env_pairs=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)
      shift
      target_user="${1:-}"
      ;;
    --cwd)
      shift
      target_cwd="${1:-}"
      ;;
    --env)
      shift
      env_pairs+=("${1:-}")
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      err "unknown argument: $1"
      ;;
  esac
  shift
done

if [[ -z "${target_user}" || -z "${target_cwd}" ]]; then
  usage
  err "--user and --cwd are required"
fi

if ! valid_user "${target_user}"; then
  err "invalid username: ${target_user}"
fi

if [[ "${target_user}" == "root" ]]; then
  err "refusing to execute as root"
fi

if ! id -u "${target_user}" >/dev/null 2>&1; then
  err "user does not exist: ${target_user}"
fi

if [[ "${target_cwd}" != /* ]]; then
  err "cwd must be an absolute path"
fi

if [[ ! -d "${target_cwd}" ]]; then
  err "cwd does not exist: ${target_cwd}"
fi

if [[ $# -lt 1 ]]; then
  usage
  err "missing command to execute"
fi

exec_bin="$1"
shift

if [[ "${exec_bin}" != /* ]]; then
  resolved="$(command -v "${exec_bin}" || true)"
  if [[ -z "${resolved}" ]]; then
    err "command not found: ${exec_bin}"
  fi
  exec_bin="${resolved}"
fi

if [[ ! -x "${exec_bin}" ]]; then
  err "command is not executable: ${exec_bin}"
fi

runuser_bin="$(command -v runuser || true)"
if [[ -z "${runuser_bin}" ]]; then
  err "runuser command not found"
fi

passwd_line="$(getent passwd "${target_user}" || true)"
if [[ -z "${passwd_line}" ]]; then
  err "failed to resolve passwd entry for user: ${target_user}"
fi

target_home="$(printf '%s' "${passwd_line}" | cut -d: -f6)"
target_shell="$(printf '%s' "${passwd_line}" | cut -d: -f7)"

if [[ -z "${target_home}" || "${target_home}" != /* ]]; then
  target_home="/home/${target_user}"
fi

if [[ -z "${target_shell}" ]]; then
  target_shell="/bin/sh"
fi

declare -a forwarded_env=()
for pair in "${env_pairs[@]}"; do
  [[ -n "${pair}" ]] || continue
  key="${pair%%=*}"
  value="${pair#*=}"
  if [[ -z "${key}" ]] || ! valid_env_key "${key}"; then
    err "invalid --env key in pair: ${pair}"
  fi
  if [[ "${value}" == *$'\n'* ]]; then
    err "invalid newline in --env value for key: ${key}"
  fi
  forwarded_env+=("${key}=${value}")
done

path_default="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
lang_default="${LANG:-C.UTF-8}"
term_default="${TERM:-xterm-256color}"

cd "${target_cwd}"

exec "${runuser_bin}" -u "${target_user}" -- \
  env -i \
  HOME="${target_home}" \
  USER="${target_user}" \
  LOGNAME="${target_user}" \
  SHELL="${target_shell}" \
  PATH="${path_default}" \
  LANG="${lang_default}" \
  TERM="${term_default}" \
  XDG_CONFIG_HOME="${target_home}/.config" \
  XDG_DATA_HOME="${target_home}/.local/share" \
  XDG_STATE_HOME="${target_home}/.local/state" \
  XDG_CACHE_HOME="${target_home}/.cache" \
  OPENCODE_EFFECTIVE_USER="${target_user}" \
  "${forwarded_env[@]}" \
  "${exec_bin}" "$@"
