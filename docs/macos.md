# Arc Local Node v0.8.0 on macOS

This guide uses the same `make testnet` workflow as the [main guide](../README.md), with macOS dependencies and Docker Desktop. Run the commands in Terminal using macOS's default shell, zsh.

The instructions target Apple Silicon. Intel users can follow the same source-build workflow with the Intel Homebrew and Docker Desktop installers, but that path has not been validated here. These instructions were checked against the [Arc v0.8.0 source](https://github.com/circlefin/arc-node/tree/v0.8.0); a complete macOS testnet build and startup has **not** been verified for this contribution.

## 1. Prepare your Mac

Use a macOS version supported by [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) and [Homebrew](https://docs.brew.sh/Installation). Start with the main guide's hardware budget: 8+ CPU cores, 16 GB RAM, and at least 80 GB of free disk. Allow room for both the host Rust build and Docker's Linux disk image; a first build can take considerably longer than later starts.

Check your architecture and available disk space:

```bash
uname -m
df -h .
```

`arm64` means Apple Silicon; `x86_64` means Intel or a shell running under Rosetta. On Apple Silicon, use a native Terminal session and ARM Homebrew rather than mixing ARM and Intel tools.

Install Apple's Command Line Tools if they are not already installed:

```bash
xcode-select --install
```

Wait for the installer to finish, then verify:

```bash
xcode-select -p
clang --version
make --version
```

## 2. Install Homebrew dependencies

Install [Homebrew](https://brew.sh/) if needed:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the installer's **Next steps** to add `brew shellenv` to your shell profile, then open a new terminal. Homebrew's default prefix is `/opt/homebrew` on Apple Silicon and `/usr/local` on Intel; the commands below use `brew --prefix` to select yours.

```bash
brew install llvm pkg-config protobuf buf node@22
export PATH="$(brew --prefix node@22)/bin:$(brew --prefix llvm)/bin:$PATH"
export LIBCLANG_PATH="$(brew --prefix llvm)/lib"
```

The [upstream macOS build instructions](https://github.com/circlefin/arc-node/blob/v0.8.0/docs/installation.md#build-from-source) require LLVM and `pkg-config` for native database bindings. `make testnet` also builds Quake on the host, so Docker alone is not enough. Protobuf and Buf are included in the [upstream development prerequisites](https://github.com/circlefin/arc-node/blob/v0.8.0/README.md#development).

Node 22 matches this guide and [upstream's CI setup](https://github.com/circlefin/arc-node/blob/v0.8.0/.github/workflows/ci.yml). The LLVM PATH and library exports also follow [upstream's macOS build workflow](https://github.com/circlefin/arc-node/blob/v0.8.0/.github/workflows/release-binaries.yaml). The `node@22` formula is keg-only, so installing it does not necessarily change the `node` already on your PATH. Check it before proceeding:

```bash
node --version
npm --version
protoc --version
buf --version
test -f "$LIBCLANG_PATH/libclang.dylib" && echo "libclang found"
```

Expect Node `v22.x`; the [main guide](../README.md#1-requirements) recommends Protobuf 3.21 or newer and Buf 1.72 or newer. If you already manage Node with nvm or another version manager, select Node 22 there instead of installing a second copy.

Keep the two `export` lines available for each new terminal used for Arc, or add them to `~/.zshrc` after any Node version-manager initialization. They select the compiler library and Node version for that shell.

## 3. Install and start Docker Desktop

Download [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/), choosing **Apple Silicon** or **Intel** to match your machine. Install it, open it, and finish its first-run setup. Docker Desktop supplies the Linux engine, Compose, and Buildx used by Arc.

```bash
open -a Docker
```

Wait until the engine is running, then check:

```bash
docker version
docker compose version
docker buildx version
docker info --format 'CPUs={{.NCPU}} MemoryBytes={{.MemTotal}} Architecture={{.Architecture}}'
```

`docker version` must report both a client and a server. In Docker Desktop's **Settings → Resources**, review the CPU, memory, and disk limits: the Linux VM has its own budget, separate from the Mac's available resources. Increase those limits if builds run out of memory or disk, while leaving enough RAM for macOS and the native Rust build. See [Docker's resource settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/#resources).

Use the engine's native architecture for local builds. Do not set `DOCKER_DEFAULT_PLATFORM=linux/amd64` globally on Apple Silicon; it forces emulation for builds that can run natively. If an individual third-party image fails to pull for ARM, see troubleshooting below.

## 4. Install Rust and Foundry

Install Rust with rustup if it is not already installed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

Install the Foundry installer if needed:

```bash
curl -L https://foundry.paradigm.xyz | bash
export PATH="$HOME/.foundry/bin:$PATH"
```

The explicit PATH works in zsh without sourcing a Bash-specific `~/.bashrc`. Select the exact Foundry version after cloning below; Arc checks it before compiling contracts.

## 5. Clone the pinned release

Keep the checkout in a local directory, such as `~/Developer`, rather than an iCloud-synced Desktop or Documents folder. Select the release **before** initializing submodules and installing JavaScript dependencies:

```bash
mkdir -p "$HOME/Developer"
cd "$HOME/Developer"
git clone --branch v0.8.0 https://github.com/circlefin/arc-node.git
cd arc-node
git submodule update --init --recursive
npm install
foundryup -i "$(cat .foundry-version)"
```

Git's detached-HEAD notice is expected when checking out a release tag. All remaining commands run from this `arc-node` directory.

```bash
git describe --tags --exact-match
rustc --version
cargo --version
forge --version
make check-foundry
```

Expect `v0.8.0`, Rust `1.93.0`, and Foundry `1.4.4`. Running Rust tools here lets rustup install and select the version in [`rust-toolchain.toml`](https://github.com/circlefin/arc-node/blob/v0.8.0/rust-toolchain.toml); there is no need to change your global Rust default. If another version appears, inspect `rustup show` for an existing override.

## 6. Start and verify the network

```bash
make testnet
```

The [upstream target](https://github.com/circlefin/arc-node/blob/v0.8.0/Makefile) compiles contracts, generates genesis, builds Linux Docker images, and runs the native Quake helper to start five validators and one full node with monitoring and Blockscout. Keep Docker Desktop running throughout. The first run downloads and compiles substantial dependencies.

After Quake reports `Testnet started`, verify the chain ID and check that blocks advance:

```bash
cast chain-id --rpc-url http://localhost:8545
cast block-number --rpc-url http://localhost:8545
sleep 3
cast block-number --rpc-url http://localhost:8545
```

The chain ID should be `1337`, and the second block number should be larger. Without `cast`, query JSON-RPC directly:

```bash
curl -sS -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  http://localhost:8545
curl -sS -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545
```

The chain ID response should contain `"result":"0x539"`. Repeat the block-number request after a few seconds to confirm it increases.

The [shared endpoints](../README.md#6-endpoints), [MetaMask configuration](../README.md#8-add-it-to-metamask), and public development accounts also apply to macOS. Open Blockscout at <http://localhost> and Grafana at <http://localhost:3000>.

## 7. Stop, restart, or reset

Stop the Arc nodes (monitoring and Blockscout remain running):

```bash
make testnet-down
```

To stop monitoring and Blockscout as well:

```bash
cargo run --bin quake -- -f crates/quake/scenarios/localdev.toml monitoring stop
```

Start it again from the same checkout:

```bash
make testnet
```

To discard the local testnet's data and generated artifacts and start fresh:

```bash
make testnet-clean
make testnet
```

`testnet-clean` deletes local chain state. Use it only when you intend to reset this development network.

## Troubleshooting

**Docker client works, but it cannot connect to the daemon**

Open Docker Desktop and wait for its engine. Check `docker context ls` and `docker context show`; if the active context points elsewhere, select Docker Desktop's `desktop-linux` context with `docker context use desktop-linux`. Also check whether you previously set `DOCKER_HOST` or `DOCKER_CONTEXT`. macOS does not use Ubuntu's `sudo service docker start` command.

**`Unable to find libclang` during the native Rust build**

Set `export LIBCLANG_PATH="$(brew --prefix llvm)/lib"` in the same terminal as `make testnet`, and verify that `libclang.dylib` exists there. On Apple Silicon, confirm that the shell, Homebrew packages, and Rust toolchain all use ARM rather than mixing Rosetta and native tools.

**Wrong Node or Foundry version**

Run `command -v node` and `command -v forge`. Reapply the PATH exports above; then select Node 22 and run `foundryup -i "$(cat .foundry-version)"` from the Arc checkout. The Makefile rejects a different Foundry version even if it is newer.

**Build exits with `Killed`, exit code 137, or `No space left on device`**

Check Docker Desktop's resource limits as well as `df -h .` and `docker system df`. Docker's VM can fill up while the Mac still has free space. Increase the relevant limit or remove only data you no longer need; a global Docker prune also affects other projects.

**`Mounts denied`**

Allow the checkout directory in Docker Desktop's **Settings → Resources → File sharing**, or move the checkout into a shared directory under your home folder. Restart the command after applying the setting.

**`Ports are not available` / `address already in use`**

Use `docker ps --format 'table {{.Names}}\t{{.Ports}}'` to find other published container ports. For a host process, run `lsof -nP -iTCP:8545 -sTCP:LISTEN`, replacing `8545` with the port named in the error. Common conflicts include 80, 3000, 8080, 8545, and 9090. Stop or reconfigure the conflicting service before starting Arc.

**`no matching manifest for linux/arm64` from a third-party image**

Identify the exact image in the error and inspect it with `docker buildx imagetools inspect IMAGE:TAG`, replacing `IMAGE:TAG` with that reference. Some auxiliary services use floating tags, so their available architectures can change independently of Arc v0.8.0. Prefer a compatible multi-architecture tag. If that service requires `linux/amd64`, configure emulation for that service only; do not force the entire Arc build to AMD64. Docker's [Mac settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/#general) explain the VM and Rosetta options.

**`xargs: illegal option -- r` during cleanup on an older macOS**

Arc v0.8.0's cleanup target uses `xargs -r`. If your system's `xargs` rejects it, install GNU findutils for this shell and retry:

```bash
brew install findutils
export PATH="$(brew --prefix findutils)/libexec/gnubin:$PATH"
make testnet-clean
```

The main guide's Docker network-database deletion and WSL disk-repair commands are specific to Linux/WSL. On macOS, use Docker Desktop's settings and diagnostics for engine or network problems.
