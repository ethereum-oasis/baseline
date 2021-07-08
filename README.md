# Baseline Protocol Hackathon Submissions 2021

### DeedNet - Tokenisation of Baseline Records using Zether Framework
- https://youtu.be/ZbyA2CrndRg

### MantleNet - Integration of BLS Signature Smart Contracts into Privacy Library
- https://youtu.be/ZbyA2CrndRg

### BeamNet - zkRollups for Baseline Scalabilty using StarkWare Cairo Compiler Circuits
- https://youtu.be/j6kcuOP-gbM

<div align="center">
  <img alt="Baseline" src="docs/assets/baseline-logo/Web/examples/PNGs/horizontal/baselineHorizontal-Logo-FullColor.png" />
  <p>
    Combining advances in cryptography, messaging, and blockchain to execute
    <br/>
    secure and private business processes via the public Ethereum Mainnet.
  </p>
  Read the full documentation <a href="https://docs.baseline-protocol.org">here at docs.baseline-protocol.org</a>.
  <p>
    <em>Join our <a href="https://communityinviter.com/apps/ethereum-baseline/join-us">Slack workspace</a>, <a href="https://discord.gg/NE8AYD7">Discord channel</a>, <a href="https://t.me/baselineprotocol">Telegram channel</a> and follow us on <a href="https://twitter.com/baselineproto">Twitter</a> for Baseline news and updates!</em>
  </p>
  <br/>
</div>

## Baseline Protocol Release `v0.1.0`

Version 0.1 of the baseline protocol packages has been released! For some background information, check out [this section](https://docs.baseline-protocol.org/baseline-protocol/the-baseline-protocol) of our docs. There are two entrypoints where you can get involved in the codebase:
- [`core/`](https://github.com/ethereum-oasis/baseline/tree/master/core) -- the "core" Baseline Protocol packages
- [`examples/bri-1`](https://github.com/ethereum-oasis/baseline/tree/master/examples/bri-1/base-example) -- the BRI-1 reference implementation.
One or more "core" baseline protocol packages are needed to baseline-enable applications and systems of record.

## Core Modules & Packages
| Package | Source Path | Description |
| -------- | ----- | ----------- |
| `@baseline-protocol/api` | `core/api` | Core *baseline* API package providing unified access to the `baseline` JSON-RPC module and blockchain, registry and key management interfaces |
| `@baseline-protocol/contracts` | `core/contracts` | Solidity contracts packaged as a Truffle project; includes ERC1820/organization registry |
| `@baseline-protocol/messaging` | `core/messaging` | Core messaging package with protocol-agnostic p2p interface with NATS and Whisper implementations |
| `@baseline-protocol/persistence` | `core/persistence` | Persistence package; this is a placeholder for system of record integration standards (see ERP connector projects under `examples/`) |
| `@baseline-protocol/privacy` | `core/privacy` | Core privacy package initially exposing a zkSnark circuit provider factory; designed to support future privacy implementations |
| `@baseline-protocol/types` | `core/types` | Core reuseable type definitions; also provides a convenience wrapper around interacting with `lib/` assets (i.e. circuits) |

## Architecture
![baseline-protocol-architecture](https://user-images.githubusercontent.com/161261/86484557-79504f00-bd24-11ea-8edb-d665cb55db20.png)

## License

All code in this repo is released under the CC0 1.0 Universal public domain dedication. For the full license text, refer to [LICENSE](LICENSE).

## Contributing

See [our contributing guidelines](CONTRIBUTING.md)
