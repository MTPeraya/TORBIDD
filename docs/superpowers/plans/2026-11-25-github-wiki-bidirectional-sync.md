# GitHub Wiki & Repository Bidirectional Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish continuous real-time bidirectional synchronization between the GitHub Wiki (`MTPeraya/TORBIDD.wiki.git`) and the repository's `docs/wiki/` directory with automated loop prevention, concurrency locking, and local developer tooling.

**Architecture:** A unified GitHub Actions workflow handles both `gollum` (Wiki edit) and `push` (repo `docs/wiki/**`) events. Loop guard filters (`[wiki-sync]` and `[skip ci]`) prevent recursive triggers, while a sequential concurrency queue prevents race conditions. A companion bash script `scripts/sync-wiki.sh` enables local pull/push/status operations.

**Tech Stack:** GitHub Actions, Git, Bash, Rsync.

**Spec:** [`docs/superpowers/specs/2026-11-25-github-wiki-bidirectional-sync-design.md`](file:///Users/mintt/Documents/Uni_Project/TORBIDD/docs/superpowers/specs/2026-11-25-github-wiki-bidirectional-sync-design.md)

## Global Constraints

- Wiki Git Remote: `https://github.com/MTPeraya/TORBIDD.wiki.git` (branch `master`)
- Main Repository Target: `docs/wiki/` on branch `main`
- Concurrency Group: `wiki-sync` with `cancel-in-progress: false`
- Commit bot attribution: `github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>`
- Automated commit prefix: `[wiki-sync] [skip ci]`

## Review Focus

1. **Infinite Trigger Loop Prevention:** Verify that automated commits pushed to `docs/wiki/` by the Action never trigger a secondary workflow that pushes back to the wiki.
2. **Empty Diff Guard:** Ensure neither the Action nor the script attempts a commit or push when there are no file changes.
3. **Deletion Mirroring:** Confirm deleted files on either the Wiki UI or `docs/wiki/` are mirrored across to the other side (handled via `rsync -av --delete --exclude '.git'`).
4. **Git Metadata Isolation:** Ensure `.git` directory of the cloned wiki is never copied into `docs/wiki/` inside the main repository.
5. **Authentication Fallback:** Confirm the workflow works with default `${{ secrets.GITHUB_TOKEN }}` while supporting an optional `${{ secrets.WIKI_SYNC_PAT }}` override if configured.

---

### Task 1: Baseline Population of `docs/wiki/`

**Files:**
- Create: `docs/wiki/*` (populated with all current wiki markdown files)

**Interfaces:**
- Consumes: Remote `https://github.com/MTPeraya/TORBIDD.wiki.git`
- Produces: `docs/wiki/` containing all current wiki documentation files

- [ ] **Step 1: Clone remote wiki into a temporary location**

```bash
git clone --depth 1 https://github.com/MTPeraya/TORBIDD.wiki.git /tmp/torbidd_wiki_initial
```

- [ ] **Step 2: Sync files into `docs/wiki/` excluding `.git`**

```bash
mkdir -p docs/wiki
rsync -av --delete --exclude '.git' /tmp/torbidd_wiki_initial/ docs/wiki/
rm -rf /tmp/torbidd_wiki_initial
```

- [ ] **Step 3: Verify all files were copied and no `.git` directory exists inside `docs/wiki`**

Run: `ls -la docs/wiki/ | wc -l && [ ! -d docs/wiki/.git ] && echo "PASS"`  
Expected: 50+ files listed and PASS

- [ ] **Step 4: Commit baseline wiki files to repository**

```bash
git add docs/wiki/
git commit -m "docs: import initial GitHub wiki pages to docs/wiki"
```

---

### Task 2: Local Developer Sync Tool (`scripts/sync-wiki.sh`)

**Files:**
- Create: `scripts/sync-wiki.sh`

**Interfaces:**
- Consumes: `docs/wiki/` and `https://github.com/MTPeraya/TORBIDD.wiki.git`
- Produces: Executable CLI script with commands `status`, `pull`, and `push`

- [ ] **Step 1: Write `scripts/sync-wiki.sh`**

Script must support:
- `pull`: Clones or fetches `TORBIDD.wiki.git` to a temporary directory, rsyncs into `docs/wiki/`, cleans up temp dir, and reports status.
- `push`: Clones `TORBIDD.wiki.git`, rsyncs `docs/wiki/` into it, checks `git diff`, commits and pushes to `master`.
- `status`: Compares `docs/wiki/` against remote wiki and reports whether they are in sync or differ.

- [ ] **Step 2: Make `scripts/sync-wiki.sh` executable and verify status check**

Run: `chmod +x scripts/sync-wiki.sh && ./scripts/sync-wiki.sh status`  
Expected: Reports that `docs/wiki/` is in sync with remote wiki.

- [ ] **Step 3: Commit `scripts/sync-wiki.sh`**

```bash
git add scripts/sync-wiki.sh
git commit -m "feat(wiki): add local sync-wiki.sh utility script"
```

---

### Task 3: GitHub Actions Bidirectional Sync Workflow (`.github/workflows/wiki-sync.yml`)

**Files:**
- Create: `.github/workflows/wiki-sync.yml`

**Interfaces:**
- Consumes: GitHub events (`gollum`, `push`, `workflow_dispatch`), repository token
- Produces: Automated background sync in `.github/workflows/wiki-sync.yml`

- [ ] **Step 1: Create `.github/workflows/wiki-sync.yml`**

Workflow specification:
1. `name: Wiki Bidirectional Sync`
2. `on:`
   - `gollum:`
   - `push: branches: [main], paths: ['docs/wiki/**']`
   - `workflow_dispatch: inputs: direction: { type: choice, options: ['auto', 'wiki-to-repo', 'repo-to-wiki'] }`
3. `concurrency: { group: 'wiki-sync', cancel-in-progress: false }`
4. `permissions: { contents: write }`
5. Jobs:
   - Check commit message loop guard (`if: "!contains(github.event.head_commit.message, '[wiki-sync]') && !contains(github.event.head_commit.message, '[skip ci]')"` for push).
   - Checkout repository (`actions/checkout@v4` with `fetch-depth: 0`).
   - Setup git user (`github-actions[bot]`).
   - If event is `gollum` or `direction == 'wiki-to-repo'`:
     - Clone `${{ github.repository }}.wiki.git`.
     - Sync to `docs/wiki/`.
     - Check diff: if changed, commit `[wiki-sync] [skip ci] Sync GitHub Wiki to docs/wiki` and push to `main`.
   - If event is `push` or `direction == 'repo-to-wiki'`:
     - Clone `${{ github.repository }}.wiki.git`.
     - Sync `docs/wiki/` to clone.
     - Check diff: if changed, commit `[wiki-sync] [skip ci] Sync docs/wiki to GitHub Wiki` and push to wiki `master`.

- [ ] **Step 2: Validate YAML syntax and configuration**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/wiki-sync.yml'))" && echo "YAML VALID"`  
Expected: `YAML VALID`

- [ ] **Step 3: Commit `.github/workflows/wiki-sync.yml`**

```bash
git add .github/workflows/wiki-sync.yml
git commit -m "ci(wiki): add bidirectional wiki sync workflow"
```

---

### Task 4: Documentation & Guide in `docs/wiki/README.md`

**Files:**
- Create: `docs/wiki/README.md`

**Interfaces:**
- Consumes: Workflow and script interfaces
- Produces: User-facing guide explaining how the bidirectional sync functions, how loop prevention works, and how to use the local script.

- [ ] **Step 1: Create `docs/wiki/README.md`**

Explain:
- Overview of bidirectional sync mechanism.
- How to edit on GitHub Wiki (web UI) and see it synced to repo.
- How to edit in repo (`docs/wiki/`) and have it automatically deployed to the Wiki.
- How to use `./scripts/sync-wiki.sh` for manual/offline operations.
- Troubleshooting and loop-prevention details.

- [ ] **Step 2: Commit `docs/wiki/README.md`**

```bash
git add docs/wiki/README.md
git commit -m "docs(wiki): add synchronization documentation in docs/wiki/README.md"
```

---

### Task 5: End-to-End Local Verification

- [ ] **Step 1: Run `./scripts/sync-wiki.sh status` to verify repository and wiki parity**
- [ ] **Step 2: Check `git status` and verify all created files and specs are tracked cleanly**
- [ ] **Step 3: Verify git commit history is clean and ready for branch push**
