# Nooby App

A cute, always-on-top Windows dynamic island for streaming chats with Gemini or OpenRouter. Built with Electron and vanilla HTML/CSS/JS—no framework, bundler, native modules, or binary assets.

## Run

```sh
npm install
npm start
```

Click the top-center pill or press **Ctrl+Alt+N**. Use the tray menu to show, hide, open Settings, or quit. Electron 45's npm package declares Node 22+; the requested Windows CI uses Node 20, where npm may print a non-fatal engine warning.

## Keys and privacy

Open **Settings** and paste a Gemini or OpenRouter API key. Keys are encrypted with Electron `safeStorage` (Windows DPAPI) in Electron's `userData` directory. Saving is refused if system encryption is unavailable. Renderers only receive key-existence status; chats and model discovery run in the main process.

Model lists are fetched live after a key is saved. Chat history (last 50 chats) and non-secret settings stay in local JSON files. No telemetry or remote application code is used.

## Build

```sh
npm run dist
```

Local Windows installers appear in `dist/`. GitHub Actions builds both NSIS and portable `.exe` files: run **Build** manually or push a `v*` tag, then download them from the workflow's **Artifacts**.
