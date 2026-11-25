#!/usr/bin/env bash
# =============================================================================
# sync-wiki.sh - Bidirectional Sync Helper for GitHub Wiki and docs/wiki/
# =============================================================================
# Usage:
#   ./scripts/sync-wiki.sh status  # Compare local docs/wiki/ with remote wiki
#   ./scripts/sync-wiki.sh pull    # Pull latest wiki changes into docs/wiki/
#   ./scripts/sync-wiki.sh push    # Push local docs/wiki/ changes to wiki repo
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WIKI_DIR="${REPO_ROOT}/docs/wiki"

# Detect remote wiki URL from origin or fallback to TORBIDD.wiki.git
ORIGIN_URL="$(git -C "${REPO_ROOT}" config --get remote.origin.url || true)"
if [[ -n "${ORIGIN_URL}" && "${ORIGIN_URL}" =~ (https://github.com/|git@github.com:)([^/]+)/([^/.]+)(\.git)? ]]; then
  OWNER="${BASH_REMATCH[2]}"
  REPO_NAME="${BASH_REMATCH[3]}"
  WIKI_URL="https://github.com/${OWNER}/${REPO_NAME}.wiki.git"
else
  WIKI_URL="https://github.com/MTPeraya/TORBIDD.wiki.git"
fi

COMMAND="${1:-status}"

function cleanup {
  if [[ -n "${TEMP_WIKI_DIR:-}" && -d "${TEMP_WIKI_DIR}" ]]; then
    rm -rf "${TEMP_WIKI_DIR}"
  fi
}
trap cleanup EXIT

case "${COMMAND}" in
  status)
    echo "==> Checking sync status between docs/wiki/ and ${WIKI_URL}..."
    TEMP_WIKI_DIR="$(mktemp -d)"
    git clone --depth 1 "${WIKI_URL}" "${TEMP_WIKI_DIR}" --quiet
    
    # Check diff excluding .git
    DIFF_OUTPUT="$(diff -r -u -x '.git' "${WIKI_DIR}" "${TEMP_WIKI_DIR}" || true)"
    if [[ -z "${DIFF_OUTPUT}" ]]; then
      echo "✅ Perfect sync: docs/wiki/ and remote GitHub Wiki are identical."
    else
      echo "⚠️ Differences detected between docs/wiki/ and remote GitHub Wiki:"
      echo "${DIFF_OUTPUT}" | head -n 30
      if [[ $(echo "${DIFF_OUTPUT}" | wc -l) -gt 30 ]]; then
        echo "... (truncated, run 'diff -r docs/wiki <remote>' for full diff)"
      fi
    fi
    ;;

  pull)
    echo "==> Pulling latest changes from ${WIKI_URL} into docs/wiki/..."
    TEMP_WIKI_DIR="$(mktemp -d)"
    git clone --depth 1 "${WIKI_URL}" "${TEMP_WIKI_DIR}" --quiet
    
    mkdir -p "${WIKI_DIR}"
    rsync -av --delete --exclude '.git' "${TEMP_WIKI_DIR}/" "${WIKI_DIR}/"
    echo "✅ Successfully synced remote wiki into docs/wiki/."
    ;;

  push)
    echo "==> Pushing changes from docs/wiki/ to ${WIKI_URL}..."
    TEMP_WIKI_DIR="$(mktemp -d)"
    git clone "${WIKI_URL}" "${TEMP_WIKI_DIR}" --quiet
    
    rsync -av --delete --exclude '.git' "${WIKI_DIR}/" "${TEMP_WIKI_DIR}/"
    
    CHANGES="$(git -C "${TEMP_WIKI_DIR}" status --porcelain)"
    if [[ -z "${CHANGES}" ]]; then
      echo "ℹ️ No changes to push to remote wiki. Everything is up to date."
    else
      echo "==> Committing and pushing the following changes to remote wiki:"
      echo "${CHANGES}"
      git -C "${TEMP_WIKI_DIR}" add -A
      git -C "${TEMP_WIKI_DIR}" commit -m "[wiki-sync] Sync docs/wiki to GitHub Wiki"
      git -C "${TEMP_WIKI_DIR}" push origin master
      echo "✅ Successfully pushed to ${WIKI_URL}."
    fi
    ;;

  -h|--help|help)
    echo "Usage: $0 [status|pull|push]"
    echo ""
    echo "Commands:"
    echo "  status   Compare local docs/wiki/ with remote wiki"
    echo "  pull     Pull remote wiki changes into docs/wiki/"
    echo "  push     Push local docs/wiki/ changes to remote wiki"
    exit 0
    ;;

  *)
    echo "Unknown command: ${COMMAND}"
    echo "Usage: $0 [status|pull|push]"
    exit 1
    ;;
esac
