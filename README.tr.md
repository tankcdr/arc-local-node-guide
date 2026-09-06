# Arc Local Node (v0.8.0) — Kendi PC'nde Kurulum Rehberi

> Bu rehber, [circlefin/arc-node](https://github.com/circlefin/arc-node) deposundaki `make testnet` akışıyla
> kendi bilgisayarında **tam bir Arc test ağı** çalıştırmanı sağlar.
> Windows 11 + WSL2 (Ubuntu) üzerinde test edildi. macOS / Linux'ta da aynı adımlar geçerli (WSL kısmını atla).

🇬🇧 English version: [README.md](README.md)

## Ne kuruyoruz?

Tek komutla ayağa kalkan yerel bir Arc ağı:

| Bileşen | Adet | Ne işe yarar |
|---|---|---|
| Execution layer (Reth tabanlı) | 6 | EVM, işlemler, RPC |
| Consensus layer (Malachite BFT) | 6 | 5 validator + 1 full node |
| Blockscout | 1 | Blok tarayıcı (kendi lokalinde) |
| Prometheus | 1 | Metrik toplama |
| Grafana | 1 | Dashboard'lar |

Ağ bilgileri: **Chain ID `1337`**, gas token **USDC**, RPC `http://localhost:8545`.

---

## 1. Gereksinimler

**Donanım (rahat çalışması için):**
- 8+ CPU çekirdeği (bende 12)
- 16 GB RAM
- **En az 80 GB boş disk** — Rust derlemesi (`target/`) tek başına ~35 GB, Docker imajları ~14 GB yer kaplıyor. Bu adımı ciddiye al.

**Yazılım:**

| Araç | Sürüm | Link |
|---|---|---|
| Rust | 1.93.0 (repo otomatik seçer) | https://rustup.rs |
| Docker Engine + Compose | v29+ | https://docs.docker.com/engine/install/ubuntu/ |
| Node.js | **çift sürüm** (22.x önerilir) | https://nodejs.org |
| Foundry | v1.4.4 (repodaki `.foundry-version`) | https://getfoundry.sh |
| Protobuf | 3.21+ | https://github.com/protocolbuffers/protobuf |
| Buf | 1.72+ | https://github.com/bufbuild/buf |

> ⚠️ Hardhat sadece **çift** Node.js sürümlerini destekler (20.x, 22.x). 23.x/25.x ile çalışmaz.

---

## 2. Windows kullanıyorsan: önce WSL2

PowerShell'i **yönetici** olarak aç:

```powershell
wsl --install -d Ubuntu
```

Bilgisayarı yeniden başlat, Ubuntu'yu aç, kullanıcı adı + şifre belirle.
Bundan sonraki **tüm komutlar Ubuntu terminalinin içinde** çalışır (Windows PowerShell'de değil).

WSL belgeleri: https://learn.microsoft.com/windows/wsl/install

> 💡 WSL'in diski (`ext4.vhdx`) C: sürücüsünde büyür ve kendi kendine küçülmez. C: sürücünde en az 80 GB boş yer olsun.

---

## 3. Bağımlılıkları kur (Ubuntu içinde)

### 3.1 Sistem paketleri

```bash
sudo apt-get update && sudo apt-get install -y build-essential pkg-config libclang-dev zlib1g-dev libssl-dev git curl unzip protobuf-compiler
```

### 3.2 Docker (WSL'in içine — Docker Desktop'a gerek yok)

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker $USER
```

Terminali kapatıp yeniden aç, sonra Docker'ı başlat:

```bash
sudo service docker start && docker ps
```

> 💡 WSL'de systemd kapalı olduğu için Docker her açılışta `sudo service docker start` ile başlatılır.

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

### 3.5 Foundry (sürüm sabit!)

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

## 4. Depoyu klonla

```bash
git clone https://github.com/circlefin/arc-node.git && cd arc-node
```

```bash
git submodule update --init --recursive && npm install
```

Belirli bir sürümü çalıştırmak istersen (biz v0.8.0 "Zero8" kullanıyoruz):

```bash
git checkout v0.8.0
```

---

## 5. Ağı başlat 🚀

```bash
make testnet
```

Bu tek komut şunları yapar: kontratları derler → genesis üretir → Docker imajlarını build eder → 5 validator + 1 full node + Blockscout + Prometheus + Grafana'yı ayağa kaldırır.

⏳ **İlk çalıştırma uzun sürer** (Rust derlemesi yüzünden makineye göre yaklaşık 30–60 dakika). Sonraki başlatmalar birkaç dakika.

Başarılı olduğunda şunu görürsün:

```
✅ Nodes have reached height 1 nodes=validator1, validator2, validator3, validator4, validator5, full1
✅ Testnet started
```

---

## 6. Adresler — nereye bakacaksın

| Servis | Adres | Not |
|---|---|---|
| **RPC (validator1)** | http://localhost:8545 | Ana JSON-RPC |
| WebSocket | ws://localhost:8546 | |
| RPC (full node) | http://localhost:9045 | |
| **Blockscout (blok tarayıcı)** | http://localhost | 80 portu |
| **Grafana** | http://localhost:3000 | Şifre yok, direkt açılır |
| Prometheus | http://localhost:9090 | |
| cAdvisor | http://localhost:8080 | Container metrikleri |

---

## 7. Çalıştığını doğrula

```bash
cast block-number --rpc-url http://localhost:8545
```

```bash
cast chain-id --rpc-url http://localhost:8545
```

`cast` yoksa curl ile:

```bash
curl -s -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545
```

Blok numarası her sorguda artıyorsa ağ çalışıyor demektir.

---

## 8. MetaMask'e ekle

- **Ağ adı:** Arc (Dev)
- **RPC URL:** `http://localhost:8545`
- **Chain ID:** `1337`
- **Sembol:** `USDC`

**Test hesapları** (standart Hardhat/Anvil mnemonic'i: `test test test test test test test test test test test junk`):

| Adres | Private key |
|---|---|
| `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |

> ⚠️ Bu anahtarlar herkese açık. **Asla** mainnet'te veya gerçek parayla kullanma. Tam liste depodaki `ACCOUNTS.md` dosyasında.

---

## 9. Günlük kullanım komutları

```bash
make testnet
```

```bash
make testnet-down
```

```bash
make testnet-clean
```

Yük testi (60 saniye boyunca saniyede 1000 tx):

```bash
make testnet-load RATE=1000 TIME=60
```

Log izleme:

```bash
docker logs -f validator1_el
```

---

## 10. Sık karşılaşılan sorunlar (hepsi başımıza geldi)

**`unexpected argument '--arc.denylist.enabled'` veya benzeri bilinmeyen flag hatası**
Eski `.quake` cache'i yeni sürümle uyuşmuyor:

```bash
rm -rf .quake/ && make testnet
```

**`EL has blocks but CL has no committed state`**
Execution layer'da eski zincir verisi, consensus'ta yeni genesis var. İkisi birlikte sıfırlanmalı:

```bash
make testnet-clean && make testnet
```

**`Pool overlaps with other one on this address space`**
Docker'ın ağ veritabanı bozulmuş:

```bash
sudo service docker stop && sudo rm -rf /var/lib/docker/network/files/local-kv.db && sudo service docker start
```

Ayrıca Docker'a daha fazla subnet alanı ver — `/etc/docker/daemon.json`:

```json
{
  "default-address-pools": [
    {"base": "172.80.0.0/16", "size": 24},
    {"base": "172.90.0.0/16", "size": 24}
  ]
}
```

**Disk doldu / `Read-only file system` (Windows + WSL)**
WSL'in sanal diski büyümüş ama küçülmemiş:

```bash
cargo clean && docker system prune -a --volumes -f
```

Sonra Windows'ta (yönetici PowerShell): `wsl --shutdown` → `diskpart` → `select vdisk file="C:\...\ext4.vhdx"` → `compact vdisk`.

**WSL çöktü, `getpwuid failed` hataları**
Yönetici PowerShell'de `wsl --shutdown`, sonra Ubuntu'yu yeniden aç.

---

## Faydalı linkler

- Arc node deposu: https://github.com/circlefin/arc-node
- Arc geliştirici dokümanları: https://docs.arc.io
- Arc web sitesi: https://www.arc.io
- Malachite (konsensüs motoru): https://github.com/circlefin/malachite
- Reth (execution layer): https://github.com/paradigmxyz/reth
- Depo içi dokümanlar: `docs/installation.md`, `docs/running-an-arc-node.md`, `docs/monitoring.md`, `docs/ARCHITECTURE.md`

---

*Windows 11 + WSL2 (Ubuntu) üzerinde Arc v0.8.0 (Zero8) ile hazırlandı — Eylül 2026.*
