# Guacalyzer

Browser-based analyzer for [QUICKSILVER](https://github.com/BossHobby/QUICKSILVER)
blackbox logs. Load the `.json` log exported by the
[Configurator](https://github.com/BossHobby/Configurator); everything is parsed
and analysed locally in the browser.

- **Overview** – flight summary, detected events (saturation, tracking error,
  RTH, missing frames), throttle strip and GPS track.
- **Tune** – step response per axis (optionally per throttle band), gyro
  filter delay, and noise spectrograms by throttle or time.
- **Navigation** – map, RTH phases and navigation loop plots for GPS logs.
- **Timeline** – configurable field graphs over time; see the key hints under
  the graphs for keyboard navigation.
- **Spectrum** – frequency content of the selected range.

The selected range can be exported as CSV. The last loaded log is kept in the
browser and reopened on reload.

## Development

Requires Node 24, a Rust toolchain, [`wasm-pack`](https://rustwasm.github.io/wasm-pack/)
and [`rsw`](https://github.com/rwasm/rsw-rs) (`cargo install wasm-pack rsw`).
The FFT, spectrogram and step-response code lives in the Rust crate under
`@cargo/analysis` and is built to WebAssembly.

```sh
npm install
npm run dev          # rsw watch + vite dev server
npm test             # vitest
cargo test --manifest-path @cargo/analysis/Cargo.toml
npm run build        # wasm build, type-check and production bundle
```
