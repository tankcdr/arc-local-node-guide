# macOS validation report

The native Quake build, full Docker build, six-node startup, RPC checks, and transaction propagation passed on Apple Silicon. Monitoring was partially functional: cAdvisor did not expose individual Arc containers, and some execution-layer scrapes timed out during observation.

Validation ran on September 16, 2026 in America/New_York; the runtime checks completed on September 17 UTC. The checkout was the unmodified [Arc v0.8.0 commit 66ad2d5aa6d9b41e8f689812004be4c7233a9e16](https://github.com/circlefin/arc-node/tree/66ad2d5aa6d9b41e8f689812004be4c7233a9e16), with recursive submodules initialized. Follow the [macOS guide](macos.md) for setup commands.

| Component | Tested environment |
| --- | --- |
| Host | macOS 26.5.1, build 25F80; Apple Silicon (`arm64`); 128 GiB RAM |
| Docker | Desktop 4.87.0; Engine 29.7.2; Linux ARM64 VM with 10 CPUs and approximately 32 GiB RAM |
| Docker tools | Compose v5.4.0; Buildx v0.36.1-desktop.1 |
| Rust | rustc and Cargo 1.93.0 |
| JavaScript | Node 22.18.0; npm 10.9.3 |
| Foundry | 1.4.4 |
| Native dependencies | Homebrew LLVM 23.1.1; Protobuf 36.1; Buf 1.73.0 |

| Check | Observed result |
| --- | --- |
| Dependencies and contracts | `npm install`, `make check-foundry`, contract compilation, and genesis generation passed. |
| Native helper | `cargo build --bin quake` passed. Quake reported v0.8.0, the clean release commit, and `aarch64-apple-darwin`. |
| Full startup | `make testnet` built both Linux ARM64 node images and started five validators plus one full node. All six reached height 1. |
| All six nodes | Each reported chain ID 1337, `eth_syncing: false`, and consensus readiness `InSync`. Heights advanced from 379 to 386 over a three-second observation. |
| WebSocket RPC | `cast block-number --rpc-url ws://localhost:8546` returned height 20. |
| Quake probes | `make testnet-test SPEC=probe` passed both connectivity and sync tests: 2 passed, 0 failed. |
| Transaction propagation | `tx:transfer` submitted through `validator1` and obtained the receipt through `full1`: 1 passed, 0 failed. All six nodes subsequently returned the same successful receipt and block hash. |
| Blockscout | Frontend returned HTTP 200. Indexed block 386 matched Arc's block hash; the test transaction was indexed with status `ok`. |
| Grafana | UI and database health checks passed. Eight intended dashboards were provisioned, and its Prometheus datasource returned metrics. Scrape availability varied as described below. |

The transaction check used:

```bash
cargo run --bin quake -- -f crates/quake/scenarios/localdev.toml test 'tx:transfer' \
  --set target_node=validator1 --set receipt_node=full1
```

It committed transaction `0x227328022877f7c9c7b347f12fd32f6dca9714eccb2acd72252acd6b10122463` in block 60, with receipt status 1 and gas used 21,000. Every node reported block hash `0x38ea8f2f081349f918b6842f71d88cfd5b0b64b40034e004ab2dab69c361832d` for that receipt.

The following findings and limits apply to this run:

- **Network reservation was necessary and tested.** The first startup failed because Docker allocated Arc's fixed subnets to its own monitoring and host-access networks before creating the node and Blockscout networks. After cleaning up that partial startup and reserving `arc_testnet_blockscout` (`172.20.0.0/16`) and internal `arc_testnet_default` (`172.21.0.0/16`) with the Compose labels shown in the guide, the full `make testnet` succeeded. No Arc source or global Docker daemon settings were changed.
- **Monitoring did not fully pass.** An initial snapshot showed all 13 Prometheus targets healthy: six execution-layer targets, six consensus-layer targets, and cAdvisor. A later snapshot showed one-second scrape timeouts for `full1_el` and `validator2_el` through `validator5_el`; Grafana's datasource reflected those failures. The remaining targets were healthy at that time. The generated configuration uses a one-second scrape interval, and no configuration changes were made to resolve the timeouts.
- **cAdvisor lacked per-container metrics.** Its HTTP endpoint was scrapeable, but it exposed aggregate VM metrics without CPU samples for any of the 12 Arc execution/consensus containers. Per-container resource panels therefore remain unverified and unavailable in this configuration; a healthy cAdvisor scrape alone does not establish container monitoring.
- **The installer path was not entirely fresh.** Node 22 came from an existing nvm installation, and some Homebrew dependencies already existed. The standard Foundry installer refused to proceed because of its active-process guard. Instead, the official Foundry 1.4.4 Darwin ARM64 release was downloaded, checked against its published SHA-256 digest, and installed in an isolated directory. The existing Foundry installation was preserved.
- **Lifecycle coverage is limited.** Quake's `monitoring stop` successfully removed the monitoring services from the failed partial startup. A complete shutdown, restart, or clean/reset cycle was not run after successful startup; the network was left running at the user's request. The guide's lifecycle commands were checked against the pinned source.
- **Platform and resource coverage is limited.** Intel Macs were not tested. This run does not establish that the guide's minimum hardware budget is sufficient, and it was a startup and functional check rather than a sustained load or stability test.
