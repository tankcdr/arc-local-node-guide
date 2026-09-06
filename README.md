# Arc Local Node (v0.8.0) — Run It On Your Own PC

> This guide gets a **complete local Arc network** running on your machine using the `make testnet`
> workflow from [circlefin/arc-node](https://github.com/circlefin/arc-node).
> Tested on Windows 11 + WSL2 (Ubuntu). The same steps work on macOS / Linux — just skip the WSL part.

🇹🇷 Türkçe sürüm: [README.tr.md](README.tr.md)

## What you get

One command brings up a full local Arc network:

| Component | Count | Purpose |
|---|---|---|
| Execution layer (Reth-based) | 6 | EVM, transactions, RPC |
| Consensus layer (Malachite BFT) | 6 | 5 validators + 1 full node |
| Blockscout | 1 | Local block explorer |
| Prometheus | 1 | Metrics collection |
| Grafana | 1 | Dashboards |

Network details: **Chain ID `1337`**, gas token **USDC**, RPC at `http://localhost:8545`.

---

## 1. Requirements

**Hardware (for a comfortable run):**
- 8+ CPU cores (12 here)
- 16 GB RAM
- **At least 80 GB free disk** — the Rust build (`target/`) alone is ~35 GB, Docker images ~14 GB. Take this seriously.

**Software:**

| Tool | Version | Link |
|---|---|---|
| Rust | 1.93.0 (repo pins it automatically) | https://rustup.rs |
| Docker Engine + Compose | v29+ | https://docs.docker.com/engine/install/ubuntu/ |
| Node.js | **even version** (22.x recommended) | https://nodejs.org |
| Foundry | v1.4.4 (see `.foundry-version` in repo) | https://getfoundry.sh |
| Protobuf | 3.21+ | https://github.com/protocolbuffers/protobuf |
| Buf | 1.72+ | https://github.com/bufbuild/buf |

> ⚠️ Hardhat only supports **even** Node.js versions (20.x, 22.x). 23.x/25.x will not work.

---

## 2. On Windows: install WSL2 first

Open PowerShell **as Administrator**:

```powershell
wsl --install -d Ubuntu
```

Reboot, open Ubuntu, set a username + password.
Every command from here on runs **inside the Ubuntu terminal**, not in Windows PowerShell.

WSL docs: https://learn.microsoft.com/windows/wsl/install

> 💡 WSL's virtual disk (`ext4.vhdx`) lives on your C: drive and never shrinks by itself. Keep at least 80 GB free there.

---

## 3. Install dependencies (inside Ubuntu)

### 3.1 System packages

```bash
sudo apt-get update && sudo apt-get install -y build-essential pkg-config libclang-dev zlib1g-dev libssl-dev git curl unzip protobuf-compiler
```

### 3.2 Docker (inside WSL — no Docker Desktop needed)

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker $USER
```

Close and reopen the terminal, then start Docker:

```bash
sudo service docker start && docker ps
```

> 💡 systemd is off in WSL by default, so start Docker with `sudo service docker start` after each reboot.

### 3.3 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

```bash
source "$HOME/.cargo/env" && rustc --version
```

### 3.4 Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
```

```bash
node --version
```

### 3.5 Foundry (pinned version!)

```bash
curl -L https://foundry.paradigm.xyz | bash
```

```bash
source ~/.bashrc && foundryup -i v1.4.4 && forge --version
```

### 3.6 Buf

```bash
sudo curl -sSL "https://github.com/bufbuild/buf/releases/latest/download/buf-$(uname -s)-$(uname -m)" -o /usr/local/bin/buf && sudo chmod +x /usr/local/bin/buf
```

---

## 4. Clone the repo

```bash
git clone https://github.com/circlefin/arc-node.git && cd arc-node
```

```bash
git submodule update --init --recursive && npm install
```

To run a specific release (we run v0.8.0 "Zero8"):

```bash
git checkout v0.8.0
```

---

## 5. Start the network 🚀

```bash
make testnet
```

That single command compiles the contracts → generates genesis → builds the Docker images → starts 5 validators + 1 full node + Blockscout + Prometheus + Grafana.

⏳ **The first run takes a while** (roughly 30–60 minutes depending on your machine, mostly the Rust build). Later starts take a few minutes.

When it works you'll see:

```
✅ Nodes have reached height 1 nodes=validator1, validator2, validator3, validator4, validator5, full1
✅ Testnet started
```

---

## 6. Endpoints

| Service | URL | Note |
|---|---|---|
| **RPC (validator1)** | http://localhost:8545 | Main JSON-RPC |
| WebSocket | ws://localhost:8546 | |
| RPC (full node) | http://localhost:9045 | |
| **Blockscout (explorer)** | http://localhost | Port 80 |
| **Grafana** | http://localhost:3000 | No login required |
| Prometheus | http://localhost:9090 | |
| cAdvisor | http://localhost:8080 | Container metrics |

---

## 7. Verify it's alive

```bash
cast block-number --rpc-url http://localhost:8545
```

```bash
cast chain-id --rpc-url http://localhost:8545
```

Without `cast`, use curl:

```bash
curl -s -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545
```

If the block number keeps climbing, your network is producing blocks.

---

## 8. Add it to MetaMask

- **Network name:** Arc (Dev)
- **RPC URL:** `http://localhost:8545`
- **Chain ID:** `1337`
- **Currency symbol:** `USDC`

**Dev accounts** (standard Hardhat/Anvil mnemonic: `test test test test test test test test test test test junk`):

| Address | Private key |
|---|---|
| `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |

> ⚠️ These keys are public knowledge. **Never** use them on mainnet or with real funds. Full list in `ACCOUNTS.md`.

---

## 9. Everyday commands

```bash
make testnet
```

```bash
make testnet-down
```

```bash
make testnet-clean
```

Load test (1000 tx/sec for 60 seconds):

```bash
make testnet-load RATE=1000 TIME=60
```

Follow logs:

```bash
docker logs -f validator1_el
```

---

## 10. Troubleshooting (all of these actually happened to us)

**`unexpected argument '--arc.denylist.enabled'` or a similar unknown-flag error**
A stale `.quake` cache from an older version. Wipe it:

```bash
rm -rf .quake/ && make testnet
```

**`EL has blocks but CL has no committed state`**
Old chain data in the execution layer against a fresh consensus genesis. They must be reset together:

```bash
make testnet-clean && make testnet
```

**`Pool overlaps with other one on this address space`**
Docker's internal network state is corrupted:

```bash
sudo service docker stop && sudo rm -rf /var/lib/docker/network/files/local-kv.db && sudo service docker start
```

Also give Docker more subnet room in `/etc/docker/daemon.json`:

```json
{
  "default-address-pools": [
    {"base": "172.80.0.0/16", "size": 24},
    {"base": "172.90.0.0/16", "size": 24}
  ]
}
```

**Disk full / `Read-only file system` (Windows + WSL)**
The WSL virtual disk grew and never shrank back:

```bash
cargo clean && docker system prune -a --volumes -f
```

Then in Windows (Admin PowerShell): `wsl --shutdown` → `diskpart` → `select vdisk file="C:\...\ext4.vhdx"` → `compact vdisk`.

**WSL crashed with `getpwuid failed`**
Run `wsl --shutdown` in Admin PowerShell, then reopen Ubuntu.

---

## Useful links

- Arc node repo: https://github.com/circlefin/arc-node
- Arc developer docs: https://docs.arc.io
- Arc website: https://www.arc.io
- Malachite (consensus engine): https://github.com/circlefin/malachite
- Reth (execution layer): https://github.com/paradigmxyz/reth
- In-repo docs: `docs/installation.md`, `docs/running-an-arc-node.md`, `docs/monitoring.md`, `docs/ARCHITECTURE.md`

---

*Written from a working setup: Arc v0.8.0 (Zero8) on Windows 11 + WSL2 (Ubuntu) — September 2026.*
