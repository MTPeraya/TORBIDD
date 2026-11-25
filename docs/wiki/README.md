# TORBIDD GitHub Wiki & Repository Documentation

This directory (`docs/wiki/`) contains the complete set of system documentation, architectural designs, API specifications, and use cases for the **TORBIDD** platform.

This directory is **automatically synchronized bidirectionally** with the project's [GitHub Wiki](https://github.com/MTPeraya/TORBIDD/wiki).

---

## 🔄 How Bidirectional Synchronization Works

### 1. Wiki UI → Repository (`docs/wiki/`)
- Whenever any page is created or edited on the GitHub Wiki web interface, GitHub triggers the `gollum` event.
- The `.github/workflows/wiki-sync.yml` workflow automatically clones the wiki and commits the updated files directly into `docs/wiki/` on the `main` branch.
- Automated commits use the message prefix `[wiki-sync] [skip ci]`.

### 2. Repository (`docs/wiki/`) → Wiki UI
- Whenever changes inside `docs/wiki/**` are pushed to the `main` branch (via direct commit or merged Pull Request), the workflow triggers.
- The workflow mirrors changes into `https://github.com/MTPeraya/TORBIDD.wiki.git` (`master` branch).
- Any commit containing `[wiki-sync]` or `[skip ci]` is automatically skipped by the trigger to prevent infinite sync loops.

### 3. Sequential Concurrency & Conflict Protection
- A shared concurrency queue (`concurrency: { group: 'wiki-sync', cancel-in-progress: false }`) guarantees that simultaneous edits are queued and processed sequentially rather than colliding.
- File synchronization uses diff verification (`git diff --staged --quiet`) to guarantee that identical states never trigger empty commits.

---

## 💻 Local Developer CLI (`scripts/sync-wiki.sh`)

Developers working locally can use the included helper script to inspect or trigger manual synchronization:

```bash
# Check if local docs/wiki/ and remote GitHub Wiki are in sync
./scripts/sync-wiki.sh status

# Pull the latest remote wiki changes into docs/wiki/
./scripts/sync-wiki.sh pull

# Push local docs/wiki/ changes directly to the remote wiki
./scripts/sync-wiki.sh push
```

---

## 📑 Key Documentation Index

| Topic | Document |
| :--- | :--- |
| **Home / Overview** | [`Home.md`](Home.md) |
| **System Architecture** | [`System-Architecture.md`](System-Architecture.md) |
| **Deployment Architecture** | [`Deployment-Architecture.md`](Deployment-Architecture.md) |
| **Database Design** | [`Database-Design.md`](Database-Design.md) |
| **API Documentation** | [`API-Documentation.md`](API-Documentation.md) |
| **Technical Decisions** | [`Technical-Decisions.md`](Technical-Decisions.md) |
| **Testing Documentation** | [`Testing-Documentation.md`](Testing-Documentation.md) |
| **UI/UX Design** | [`UI-UX-Design.md`](UI-UX-Design.md) |
| **Environment Variables** | [`Environment-Variables.md`](Environment-Variables.md) |
| **Development Setup** | [`Development-Setup.md`](Development-Setup.md) |
