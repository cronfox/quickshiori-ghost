# quickshiori-ghost

Quickshiori's Demo Ghost — working in Git Submodule

A scaffold that automatically fetches the latest [QuickShiori](https://github.com/cronfox/quickshiori) release and keeps the runtime DLLs up to date.

## Getting Started

1. Use this repository as a template (or fork it) for your own Ukagaka ghost.
2. Edit `index.js` to implement your ghost's SHIORI logic.
3. The included GitHub Actions workflow will automatically open a Pull Request whenever a new QuickShiori release is published.

## Auto-update Workflow

The workflow at `.github/workflows/update-quickshiori.yml` runs daily and:

- Fetches the latest release from [cronfox/quickshiori](https://github.com/cronfox/quickshiori/releases).
- Downloads the Windows i386 release zip.
- Extracts the DLL files (`quickshiori.dll`, `qjs.dll`, etc.) into the repository root.
- Opens a Pull Request with the updated binaries.

You can also trigger the workflow manually from the **Actions** tab, with an optional **Force update** flag to re-download the current version.

## Ghost Entry Point

`index.js` is the main script loaded by the QuickShiori runtime. Implement the three global functions to handle SHIORI lifecycle events:

```js
globalThis.__shiori_load = function (dir) { /* initialise */ };
globalThis.__shiori_request = function (rawRequest) { /* handle request, return response */ };
globalThis.__shiori_unload = function () { /* cleanup */ };
```

See [quickshiori.d.ts](https://github.com/cronfox/quickshiori/blob/master/quickshiori.d.ts) for full type documentation.
