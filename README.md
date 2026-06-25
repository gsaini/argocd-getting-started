# Argo CD — Build Once, Deploy Many

> An end-to-end GitOps demo: build a container image **once**, then promote that
> exact same artifact through **dev → staging → prod** with Argo CD. Only
> configuration changes between environments — never the binary.

![Argo CD](https://img.shields.io/badge/Argo%20CD-EF7B4D?style=for-the-badge&logo=argo&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![Kustomize](https://img.shields.io/badge/Kustomize-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![GHCR](https://img.shields.io/badge/GHCR-181717?style=for-the-badge&logo=github&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-A31F34?style=for-the-badge)

[![build-once](https://github.com/gsaini/argocd-getting-started/actions/workflows/build.yaml/badge.svg)](https://github.com/gsaini/argocd-getting-started/actions/workflows/build.yaml)
[![validate-manifests](https://github.com/gsaini/argocd-getting-started/actions/workflows/validate.yaml/badge.svg)](https://github.com/gsaini/argocd-getting-started/actions/workflows/validate.yaml)

---

## The core idea

In a healthy delivery pipeline you build an artifact **once**, test it, and then
promote *that same artifact* forward. Rebuilding per environment means each
environment runs subtly different bytes — the thing you tested is not the thing
you shipped.

This repo makes that principle concrete:

- **Built once** — CI builds `ghcr.io/gsaini/argocd-getting-started:sha-<commit>`
  and bakes the version + git SHA into the image. That immutable tag is the unit
  of promotion.
- **Deployed many** — three Kustomize overlays share one base. Promotion is
  literally copying the same image tag from one overlay to the next.
- **Reconciled by Argo CD** — each environment is an Argo CD `Application`. dev
  and staging auto-sync; prod waits for a human to click sync.

The running app shows this at a glance: **Build version** and **Git SHA** are
identical in every environment, while the **Environment** badge changes.

See [docs/architecture.md](docs/architecture.md) for the full diagram.

## Repository layout

```
app/                      # tiny zero-dependency Node web app + Dockerfile
k8s/
  base/                   # environment-agnostic Deployment + Service + config
  overlays/
    dev/                  # APP_ENV=dev,     1 replica
    staging/              # APP_ENV=staging, 2 replicas
    prod/                 # APP_ENV=prod,    3 replicas, tighter limits
argocd/
  project.yaml            # AppProject (guardrails: repos, destinations)
  applications/           # one Application per environment
  app-of-apps.yaml        # root app that installs the three Applications
  applicationset.yaml     # alternative: generate all three from one list
.github/workflows/
  build.yaml              # build once -> push -> bump dev overlay
  promote.yaml            # copy the same tag dev -> staging -> prod
  validate.yaml           # kustomize build on every overlay (PR gate)
scripts/bootstrap.sh      # apply the AppProject + app-of-apps
docs/architecture.md
```

## Quick start

### 1. Prerequisites

- A Kubernetes cluster — [kind](https://kind.sigs.k8s.io/),
  [minikube](https://minikube.sigs.k8s.io/), k3d, or a real one
- `kubectl`, and [Argo CD](https://argo-cd.readthedocs.io/) installed:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 2. Bootstrap the demo

```bash
./scripts/bootstrap.sh
# or directly:
kubectl apply -f argocd/project.yaml
kubectl apply -f argocd/app-of-apps.yaml
```

Then watch it reconcile:

```bash
kubectl get applications -n argocd
argocd app list
```

### 3. See an environment

```bash
kubectl -n argocd-demo-dev port-forward svc/web 8080:80
open http://localhost:8080         # try also /api/info and /healthz
```

## The promotion flow

1. **Push a change to `app/`** on `main`. `build.yaml` builds one image, pushes
   it to GHCR, and updates `k8s/overlays/dev` to the new `sha-…` tag.
2. **Argo CD auto-syncs dev.** The new version is live in `argocd-demo-dev`.
3. **Promote to staging** — run the `promote` workflow with target `staging`
   (Actions tab → *promote* → *Run workflow*). It copies dev's tag into the
   staging overlay; Argo CD auto-syncs staging.
4. **Promote to prod** — run `promote` with target `prod`. It copies staging's
   tag into the prod overlay. Because prod is **manual-sync**, release with:

   ```bash
   argocd app sync demo-prod
   ```

No step rebuilds the image — the `sha-…` string is the only thing moving.

## Try it locally (no cluster)

```bash
cd app
APP_ENV=local node server.js
# http://localhost:8080
```

Or with Docker, baking build metadata exactly as CI does:

```bash
docker build -t argocd-demo ./app \
  --build-arg APP_VERSION=1.0.0-local \
  --build-arg GIT_SHA="$(git rev-parse --short HEAD)"
docker run --rm -p 8080:8080 -e APP_ENV=local argocd-demo
```

## Using this in your own account

The manifests reference `gsaini` as the GitHub owner. If you fork or copy this
repo, replace `gsaini` with your GitHub username/org in:

- `k8s/base/kustomization.yaml` and the three overlays (image name)
- `argocd/**` (repo URLs)
- the badge/links in this README

```bash
grep -rl gsaini . | xargs sed -i '' 's/gsaini/your-name/g'   # macOS
```

## License

[MIT](LICENSE)
