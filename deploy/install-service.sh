#!/usr/bin/env bash
# Install the systemd service for the current user and repo location.
# Run from anywhere inside the repo:  ./deploy/install-service.sh
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
user="$(id -un)"
node_bin="$(command -v node || true)"

if [[ -z "$node_bin" ]]; then
  echo "Node.js not found. Install Node 22 first (see docs/deploy.md)." >&2
  exit 1
fi
if [[ ! -f "$repo/dist/index.html" ]]; then
  echo "No build found. Run 'npm ci && npm run build' in $repo first." >&2
  exit 1
fi

mkdir -p "$repo/data"

sed -e "s|^User=.*|User=$user|" \
    -e "s|/home/pi/buoni-postali|$repo|g" \
    -e "s|^ExecStart=/usr/bin/node |ExecStart=$node_bin |" \
    "$repo/deploy/buoni-postali.service" |
  sudo tee /etc/systemd/system/buoni-postali.service >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable buoni-postali
sudo systemctl restart buoni-postali
sleep 1
systemctl --no-pager status buoni-postali | head -n 5

port="$(grep -oP '^Environment=PORT=\K\d+' /etc/systemd/system/buoni-postali.service)"
echo
echo "Open http://$(hostname).local:$port or http://$(hostname -I | awk '{print $1}'):$port"
