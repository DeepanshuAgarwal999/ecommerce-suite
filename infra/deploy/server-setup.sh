#!/usr/bin/env bash
# One-time preparation of a fresh Oracle Cloud Ubuntu 24.04 VM (Ampere A1 / arm64).
# Run as the default `ubuntu` user:   bash infra/deploy/server-setup.sh
#
#   - installs Docker Engine + the compose plugin from Docker's apt repo
#   - opens 80/443 in the host firewall (Oracle's Ubuntu image REJECTs everything but 22)
#   - adds a 4 GB swap file as a cushion for image builds
#
# Ports 80/443 must ALSO be allowed in the VCN security list in the Oracle console;
# see infra/deploy/README.md.
set -euo pipefail

echo "[setup] installing Docker"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git netfilter-persistent iptables-persistent
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
sudo systemctl enable --now docker

echo "[setup] opening ports 80 and 443 in iptables"
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    # Insert above Oracle's catch-all REJECT rule.
    sudo iptables -I INPUT 5 -p tcp --dport "$port" -j ACCEPT
  fi
done
if ! sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 5 -p udp --dport 443 -j ACCEPT
fi
sudo netfilter-persistent save

if [ ! -f /swapfile ]; then
  echo "[setup] adding 4G swap"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

echo "[setup] done. Log out and back in (so the docker group applies), then run infra/deploy/deploy.sh"
