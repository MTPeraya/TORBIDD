# Design Document: GitHub Wiki & Repository Bidirectional Synchronization

**Date**: 2026-11-25  
**Author**: Antigravity  
**Topic**: Bidirectional synchronization between GitHub Wiki and `docs/wiki/` in repository  
**Approach Selected**: Option 1 (Unified GitHub Actions Workflow with Concurrency & Loop Guard)

---

## 1. Intent and the "Why"
The TORBIDD project contains comprehensive documentation hosted in the repository's GitHub Wiki (`https://github.com/MTPeraya/TORBIDD.wiki.git`, consisting of over 50 architectural, API, use case, and security specification documents).

Currently, the GitHub Wiki and the main code repository are disconnected:
- Documentation edited directly in the GitHub Wiki web interface is not version-controlled inside the repository's pull request and code-review pipeline.
- Developers working in local IDEs cannot easily reference, search, or edit wiki documents alongside the application code in `docs/wiki/`.
- Updates to documentation inside the repository do not automatically reflect on the public-facing GitHub Wiki.

The bidirectional synchronization system bridges this gap, establishing continuous real-time synchronization between the GitHub Wiki and `docs/wiki/` in the `main` branch.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Real-time Bidirectional Sync**:
  - Edits on the GitHub Wiki interface automatically commit to `docs/wiki/` in the `main` branch.
  - Commits to `docs/wiki/**` on `main` automatically push to the GitHub Wiki repository (`refs/heads/master`).
- **Infinite Loop Prevention**: Strict guardrails using commit message flags (`[wiki-sync]`, `[skip ci]`) and `git diff --quiet` checks to ensure automated commits never trigger recursive workflow runs.
- **Race Condition & Conflict Prevention**: Use GitHub Actions sequential concurrency (`concurrency: { group: 'wiki-sync', cancel-in-progress: false }`) so simultaneous actions queue and execute cleanly.
- **Full Fidelity & Deletion Mirroring**: Mirror additions, modifications, and file deletions accurately (using `rsync -av --delete --exclude '.git'`).
- **Initial Sync**: Immediately import all current 50+ wiki documents into `docs/wiki/` in the repository.
- **Local Helper Script**: Provide `scripts/sync-wiki.sh` allowing developers to pull/push the wiki locally from their terminal if desired.

### Non-Goals
- Real-time collaborative live editing (conflicts are resolved on a latest-commit-wins basis per queued action).
- Syncing non-markdown media or massive binaries exceeding GitHub's standard wiki limits.

### Anti-Goals
- No recursive action loops that consume GitHub Actions minutes.
- No clobbering of files without diff verification.
- No complex external webhooks or third-party paid services; standard GitHub Actions only.

---

## 3. Constraints & Technical Considerations
- **Repository Remotes**:
  - Main repository: `https://github.com/MTPeraya/TORBIDD.git` (Default branch: `main`)
  - Wiki repository: `https://github.com/MTPeraya/TORBIDD.wiki.git` (Default branch: `master`)
- **Authentication**:
  - Uses `GITHUB_TOKEN` with `contents: write` permission.
  - Supports an optional repository secret `WIKI_SYNC_PAT` for environments where GitHub restrictions require a Personal Access Token for wiki git operations, falling back gracefully to `GITHUB_TOKEN`.
- **Target Directory**: `docs/wiki/` at the root of the main repository.

---

## 4. Approaches Considered & Trade-offs

### Approach 1: Unified GitHub Actions Workflow with Loop Guard (Selected)
- **Architecture**: A single `.github/workflows/wiki-sync.yml` responding to:
  1. `gollum`: Wiki UI edits.
  2. `push`: Path-filtered on `docs/wiki/**` on `main`.
  3. `workflow_dispatch`: Manual trigger with optional direction input (`auto`, `wiki-to-repo`, `repo-to-wiki`).
- **Loop Guard**:
  - When committing to repo: Commits are authored as `github-actions[bot]` with message `[wiki-sync] [skip ci] Sync GitHub Wiki to docs/wiki`.
  - When reacting to repo push: Steps check `if: "!contains(github.event.head_commit.message, '[wiki-sync]') && !contains(github.event.head_commit.message, '[skip ci]')"` before pushing to wiki.
  - `git diff --quiet` is checked before any commit or push; if identical, no-op.
- **Why Selected**: Provides real-time synchronization, centralized maintenance, and bulletproof loop prevention.

### Approach 2: Periodic Scheduled Cron Reconcile
- **Architecture**: Runs every $N$ hours to compare and sync changes.
- **Trade-off Rejected**: Not real-time; edits take hours to reflect; greater window for merge conflicts.

### Approach 3: Two Separate Workflows (`wiki-to-repo.yml` and `repo-to-wiki.yml`)
- **Architecture**: Decoupled workflow files for each direction.
- **Trade-off Rejected**: Duplicate authentication logic; harder to coordinate shared concurrency locks cleanly across files.

---

## 5. Implementation Specification

### 5.1 Workflow File: `.github/workflows/wiki-sync.yml`
```yaml
name: Wiki Bidirectional Sync

on:
  gollum:
  push:
    branches:
      - main
    paths:
      - 'docs/wiki/**'
  workflow_dispatch:
    inputs:
      direction:
        description: 'Sync Direction'
        required: true
        default: 'auto'
        type: choice
        options:
          - 'auto'
          - 'wiki-to-repo'
          - 'repo-to-wiki'

concurrency:
  group: wiki-sync
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  sync:
    name: Synchronize Wiki
    runs-on: ubuntu-latest
    steps:
      ...
```

### 5.2 Local Script: `scripts/sync-wiki.sh`
A shell script supporting:
- `./scripts/sync-wiki.sh pull`: Pulls latest wiki to `docs/wiki/`.
- `./scripts/sync-wiki.sh push`: Pushes `docs/wiki/` to the wiki repository.
- `./scripts/sync-wiki.sh status`: Shows diff between `docs/wiki/` and the wiki remote.

### 5.3 Initial Documentation Migration
Clone `https://github.com/MTPeraya/TORBIDD.wiki.git` into `docs/wiki/` in the local workspace so that the baseline is immediately established.

---

## 6. Verification Plan
1. **Initial Population**: Confirm all 50+ wiki files exist in `docs/wiki/` and mirror `TORBIDD.wiki.git`.
2. **Local Script Verification**: Run `./scripts/sync-wiki.sh status` to ensure clean parity with remote wiki.
3. **Action Syntax & Dry-run**: Validate YAML schema with action linting and verify condition logic for `gollum`, `push`, and `workflow_dispatch`.
4. **Git Safety Check**: Confirm `.git` directories from the wiki clone are not committed to `docs/wiki/`.
