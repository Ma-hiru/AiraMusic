# <img src="packages/app/assets/logo.svg" width="28" /> AiraMusic

A desktop third-party NetEase Cloud Music player built with Electron, React, Vue, and TypeScript.

[中文](README.md)

## Status

🚧 Work in progress

## Screenshots

### Multi-window

![All windows](docs/images/all_windows.png)

### Playlist

![Playlist](docs/images/playlist.png)

### Player

![Player 1](docs/images/player.png)
![Player 2](docs/images/player2.png)
![Player 3](docs/images/player3.png)

### Settings

![Settings 1](docs/images/settings.png)
![Settings 2](docs/images/settings2.png)

### Artist

![Artist](docs/images/artist.png)
![Artist albums](docs/images/artist_album.png)

### Album

![Album](docs/images/album.png)

### Search

![Search](docs/images/search.png)

### Home

![Home 1](docs/images/home.png)
![Home 2](docs/images/home2.png)

### Tray

![Tray](docs/images/tray.png)

## Dependencies and Architecture

AiraMusic is a Yarn workspaces monorepo. The desktop shell, renderer layer, cache service, and WASM utilities live in separate packages. At runtime, the Electron main process coordinates them.

```text
packages/ui  -- renderer windows built by Vite
    |
    |-- /api   --> NetEase API service (@neteasecloudmusicapienhanced/api)
    `-- /cache --> Go cache store service (Gin)

packages/app -- Electron main process
    |-- registers IPC handlers and the custom app protocol
    |-- starts the NetEase API service in a utility process
    |-- starts an Express proxy service in a utility process
    `-- starts the Go cache store binary through @mahiru/store

packages/wasm -- Rust + wasm-bindgen modules used by the renderer
```

### Workspace Overview

| Package          | Role                                                                                                                                                                                                                                          | Main dependencies                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui`    | Renderer application. Vite builds multiple renderer entries such as `index`, `login`, `mini`, `lyric`, `tray`, `image`, `comments`, and `display`. React is used for the main renderer flow, and Vue is also used by several smaller windows. | React 19, Vue 3, Vite 8, Tailwind CSS 4, SCSS, React Router 7, Zustand, Jotai, Motion, Lucide, Heroicons, Axios, `@applemusic-like-lyrics/lyric`, `@mahiru/wasm` |
| `packages/app`   | Electron main process. It owns app startup, window management, tray registration, IPC handlers, custom protocol handling, service lifecycle, and Electron packaging input.                                                                    | Electron 40, tsup, `@neteasecloudmusicapienhanced/api`, Express, `express-http-proxy`, `electron-store`, Zod, `@mahiru/store`, `@mahiru/ipc`                     |
| `packages/store` | Local cache store service. It is a Go HTTP service used by the renderer through `/cache`, and is wrapped by a TypeScript launcher so the Electron app can start and stop it.                                                                  | Go 1.25, Gin, gin-contrib/cors                                                                                                                                   |
| `packages/wasm`  | Rust WebAssembly package for renderer-side native-speed utilities. Current modules cover lyric parsing, theme/image color processing, spectrum processing, search helpers, and WebGL renderer support.                                        | Rust 2024, wasm-bindgen, wasm-pack, serde, tsify, image, rustfft, regex, web-sys                                                                                 |
| `packages/ipc`   | Shared TypeScript IPC type definitions for main/renderer invoke and message contracts.                                                                                                                                                        | `@mahiru/log`                                                                                                                                                    |
| `packages/log`   | Shared logging primitives used by app and renderer packages.                                                                                                                                                                                  | TypeScript                                                                                                                                                       |

### Tooling

- Package manager: Yarn 4 workspaces.
- TypeScript checks: project references with `vue-tsc -b`.
- Frontend tests: Vitest with jsdom.
- Store service checks: `go test`, `go fmt`, `go vet`.
- WASM checks: `cargo test`, `cargo fmt`, `cargo clippy`.
- Packaging: `electron-builder`.

## Build

### Requirements

- Node.js
- Rust
- wasm-pack
- Go

Install wasm-pack:

```bash
cargo install wasm-pack
```

### Install Dependencies

```bash
yarn install --frozen-lockfile
```

### Development

```bash
yarn build:wasm && yarn build:store # first run only
yarn dev
```

### Production Build

```bash
yarn build
```
