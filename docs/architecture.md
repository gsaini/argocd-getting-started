# Architecture

## Build once, deploy many

The central idea: an artifact is built **exactly one time** and the *same*
artifact is promoted, unchanged, through every environment. Only configuration
differs per environment.

```
            ┌──────────────────────────────────────────────────────────┐
            │                     build-once (CI)                        │
  app/**  ─▶│  docker build  ──▶  ghcr.io/gsaini/...:sha-abc123 (push)    │
   push     │       │                                                    │
            │       └─▶ bump k8s/overlays/dev  →  newTag: sha-abc123     │
            └──────────────────────────────────────────────────────────┘
                                     │ git commit
                                     ▼
            ┌──────────────────────────────────────────────────────────┐
            │                     promote (CI, manual)                   │
            │   dev tag ──▶ staging overlay ──▶ prod overlay            │
            │        (copies the SAME sha-abc123 forward, no rebuild)    │
            └──────────────────────────────────────────────────────────┘
                                     │ git commit
                                     ▼
            ┌──────────────────────────────────────────────────────────┐
            │                        Argo CD                             │
            │   demo-dev      (auto-sync)   ──▶ ns argocd-demo-dev       │
            │   demo-staging  (auto-sync)   ──▶ ns argocd-demo-staging   │
            │   demo-prod     (manual sync) ──▶ ns argocd-demo-prod      │
            └──────────────────────────────────────────────────────────┘
```

## What is identical vs. what changes

| Concern            | Where it lives                       | Same across envs? |
| ------------------ | ------------------------------------ | ----------------- |
| Image (binary)     | GHCR, pinned by immutable `sha-` tag | ✅ identical       |
| `VERSION`/`GIT_SHA`| Baked into image at build time       | ✅ identical       |
| `APP_ENV`/greeting | Overlay `configMapGenerator`         | ❌ per-env         |
| Replicas/resources | Overlay `patches`                    | ❌ per-env         |
| Namespace          | Overlay `namespace`                  | ❌ per-env         |

## Why the image tag is immutable

Tags like `latest` are mutable — two clusters pulling `latest` can end up on
different bytes. The demo pins `sha-<short>` so the deployed artifact is
provably the one that was built and tested. Promotion is just "copy that string
into the next overlay", which Git records as an auditable change.

## Two ways to register the Applications

- **App-of-apps** (`argocd/app-of-apps.yaml`) — a root Application that renders
  the three Applications in `argocd/applications/`. This is what `bootstrap.sh`
  uses.
- **ApplicationSet** (`argocd/applicationset.yaml`) — generates the same three
  Applications from one list. Apply *either* this *or* the app-of-apps, not both.
