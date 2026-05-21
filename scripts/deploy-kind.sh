#!/bin/bash
set -euo pipefail

# Check prerequisites
command -v kind >/dev/null 2>&1 || { echo "kind not found. Install: brew install kind"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found. Install: brew install kubectl"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker not found. Install Docker Desktop"; exit 1; }

echo "=== Ollive Inference Logger — kind Deployment ==="
echo ""

# Create kind cluster with ingress-ready config
if kind get clusters 2>/dev/null | grep -q "^ollive$"; then
    echo "kind cluster 'ollive' already exists, skipping creation..."
else
    echo "Creating kind cluster..."
    cat <<EOF | kind create cluster --name ollive --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF
fi

# Install NGINX Ingress Controller
echo "Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
echo "Waiting for ingress controller to be ready..."
kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=90s

# Build and load images
echo ""
echo "Building Docker images..."
docker build -t ollive-backend:latest ./backend
docker build -t ollive-worker:latest ./worker
docker build -t ollive-frontend:latest ./frontend

echo "Loading images into kind..."
kind load docker-image ollive-backend:latest --name ollive
kind load docker-image ollive-worker:latest --name ollive
kind load docker-image ollive-frontend:latest --name ollive

# Apply K8s manifests
echo ""
echo "Deploying to Kubernetes..."
kubectl apply -k k8s/

# Wait for pods
echo "Waiting for pods to be ready..."
kubectl wait --namespace ollive \
    --for=condition=ready pod \
    --all \
    --timeout=120s

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo ""
echo "Add this to /etc/hosts if not already present:"
echo "  127.0.0.1 ollive.local"
echo ""
echo "Then visit: http://ollive.local"
echo ""
echo "Useful commands:"
echo "  kubectl get pods -n ollive           # Check pod status"
echo "  kubectl logs -n ollive -l app=backend # Backend logs"
echo "  kubectl logs -n ollive -l app=worker  # Worker logs"
echo "  kind delete cluster --name ollive     # Tear down"
