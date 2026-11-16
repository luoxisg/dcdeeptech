#!/usr/bin/env bash
set -euo pipefail
# Uses the user's native Cloud Shell authorization; no Firebase CLI code is needed.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if ! command -v gcloud >/dev/null 2>&1; then
  echo '请在 Google Cloud Shell 中运行此命令。' >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)'; then
  if [[ -f "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm install 22
    nvm use 22
  else
    echo '需要 Node.js 22 或更新版本。请使用新版 Google Cloud Shell。' >&2
    exit 1
  fi
fi
npm ci --prefix "$repo_root/dfplan-backend" --omit=dev --no-audit --no-fund
node "$repo_root/dfplan-backend/scripts/deploy-cloudshell.mjs" "$@"
