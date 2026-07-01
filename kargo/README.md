# Kargo — continuous promotion (dev → staging → prod)

[Kargo](https://kargo.akuity.io/) layers a promotion pipeline on top of the Argo
CD setup in this repo. It watches the container image, packages each new build as
**Freight**, and promotes that Freight stage-by-stage by writing the overlay's
`newTag:` back to Git — the exact "build once, deploy many" move that
[`promote.yaml`](../.github/workflows/promote.yaml) does manually today, but
declarative and gated.

## How it maps to this repo

| Kargo object              | What it does here                                                       |
| ------------------------- | ----------------------------------------------------------------------- |
| `Warehouse/web`           | Polls `ghcr.io/gsaini/...`, makes Freight from each `sha-<commit>` tag   |
| `Stage/dev`               | Auto-promotes new Freight → bumps `k8s/overlays/dev` → syncs `demo-dev`  |
| `Stage/staging`           | Auto-promotes Freight that passed dev → bumps staging → syncs            |
| `Stage/prod`              | **Manual** promotion → bumps prod → syncs `demo-prod` (the release gate) |
| `ProjectConfig`           | Sets which stages auto-promote (dev/staging yes, prod no)               |

Each Stage's promotion runs the same steps: `git-clone → kustomize-set-image →
git-commit → git-push → argocd-update`. Argo CD remains the thing that actually
reconciles the cluster; Kargo just decides *what* tag each environment should be
on and *when*.

## Prerequisites

- The Argo CD demo already bootstrapped (see the repo [README](../README.md)).
- Kargo installed in the cluster:

  ```bash
  helm install kargo oci://ghcr.io/akuity/kargo-charts/kargo \
    --namespace kargo --create-namespace --wait
  ```

## Bootstrap

```bash
# 1. Project + namespace + auto-promotion policy
kubectl apply -f kargo/project.yaml

# 2. Git write credentials (Kargo pushes promotions back to main)
cp kargo/credentials.example.yaml kargo/credentials.yaml
$EDITOR kargo/credentials.yaml          # add a PAT with repo write; do NOT commit
kubectl apply -f kargo/credentials.yaml

# 3. The Warehouse and the three Stages
kubectl apply -f kargo/warehouse.yaml
kubectl apply -f kargo/stages/
```

The Argo CD Applications carry a `kargo.akuity.io/authorized-stage` annotation
(already set in `argocd/applications/*` and the ApplicationSet) so Kargo is
allowed to sync them.

## Releasing to prod

dev and staging promote themselves as Freight flows through. prod is manual:

```bash
# list Freight that has reached staging and is eligible for prod
kargo get freight --project argocd-getting-started

# release it
kargo promote --project argocd-getting-started --stage prod --freight <freight-name>
```

…or click **Promote** on the prod stage in the Kargo UI.

## Relationship to the existing GitHub Actions

Kargo and `promote.yaml` both write `newTag:` and push — running both would have
them fighting over the same files. Adopt Kargo by:

- **Keep** [`build.yaml`](../.github/workflows/build.yaml) building and pushing the
  image, but **drop its "Promote new build to dev overlay" step** — the
  `Warehouse` + `dev` Stage now owns moving dev to the latest build.
- **Retire** [`promote.yaml`](../.github/workflows/promote.yaml) — staging/prod
  promotion is now Kargo's job.

These CI edits aren't applied yet, so the two systems don't collide until you
choose to switch. Say the word and I'll make them.

> **Version note:** manifests target Kargo v1.x (`kargo.akuity.io/v1alpha1`,
> promotion *steps*). On Kargo < 1.1, move `promotionPolicies` from
> `ProjectConfig` into `Project.spec`.
