#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# One-shot bootstrap for the demo.
#
# Prereqs:
#   - A Kubernetes cluster (kind / minikube / k3d / real cluster)
#   - kubectl pointed at it
#   - Argo CD installed in the `argocd` namespace
#       kubectl create namespace argocd
#       kubectl apply -n argocd -f \
#         https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
#
# This applies the AppProject and the app-of-apps root Application, which in
# turn creates the dev/staging/prod Applications.
# ---------------------------------------------------------------------------

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Applying AppProject"
kubectl apply -f "${REPO_ROOT}/argocd/project.yaml"

echo "==> Applying app-of-apps root Application"
kubectl apply -f "${REPO_ROOT}/argocd/app-of-apps.yaml"

cat <<'EOF'

Done. Watch it come up with:

  kubectl get applications -n argocd
  argocd app list

dev and staging auto-sync. prod waits for a manual sync:

  argocd app sync demo-prod

EOF
