# degoog-web-loader

Open WebUI external web loader plugin for [degoog](https://github.com/degoog-org/degoog).

This plugin exposes an HTTP endpoint that Open WebUI can use as an external web loader. It fetches pages through degoog's transport layer (4play browser, curl, flaresolverr, etc.) or falls back to plain HTTP fetch.

## Architecture

```
[Firefox - één profiel]
  └── lolcat/4play extensie → ws://127.0.0.1:4444/ws/.../cnc

[degoog container :4444]
  ├── degoog HTTP API (SearXNG shape) → Open WebUI web search
  ├── transports (4play browser, curl, flaresolverr, ...)
  └── degoog-web-loader plugin → POST /api/plugin/<id>/fetch

[Open WebUI]
  └── WEB_LOADER_ENGINE=external → http://<degoog-host>:4444/api/plugin/<id>/fetch
```

## Installation

### 1. Install the plugin

**Option A — via the degoog Store (recommended):**

In degoog, go to **Store**, add this repository as a source:

```
https://github.com/HenkieTenkie62/degoog-web-loader
```

Then install **Degoog Web Loader** from the store.

**Option B — manual:**

Copy the `plugins/degoog-web-loader/` folder to the degoog plugins directory:

```bash
# On the machine running degoog
cp -r plugins/degoog-web-loader/ /path/to/degoog/data/plugins/degoog-web-loader/
```

### 2. Configure Open WebUI

In Open WebUI, set the following environment variables (or via Admin Panel → Settings → Web Search):

```
WEB_LOADER_ENGINE=external
EXTERNAL_WEB_LOADER_URL=http://<degoog-host>:4444/api/plugin/degoog-web-loader/fetch
```

No API key is needed — the endpoint is only accessible from the local network.

## How it works

1. Open WebUI sends a POST request to the plugin's `/fetch` endpoint with:
   ```json
   {
     "urls": ["https://example.com", "https://foo.org"],
     "transport": "4play"
   }
   ```

2. The `transport` field is optional. When provided, the plugin routes the request
   through that degoog transport (e.g. `4play`, `curl`, `flaresolverr`). When omitted
   or the transport is unavailable, it falls back to plain HTTP fetch.

3. For each URL:
   - The transport fetches the page (real browser session for 4play, plain HTTP for curl)
   - The plugin extracts text content from the HTML
   - Returns the response in the format Open WebUI expects

4. Response format:
   ```json
   [
     {
       "page_content": "page text content...",
       "metadata": {
         "source": "https://example.com",
         "title": "Page Title",
         "description": "Meta description"
       }
     }
   ]
   ```

## Available transports

The transport name is passed in the request body and must match an installed degoog
transport. Common options:

| Transport | Description |
|-----------|-------------|
| `4play` | Real Firefox browser via the lolcat 4play extension |
| `curl` | System curl |
| `flaresolverr` | Cloudflare bypass via FlareSolverr |
| `browserless` | Headless browser via Browserless |
| `cloakbrowser` | Stealth Chromium via CloakBrowser |
| `camoufox` | Stealth Firefox via Camoufox |

Any transport installed in degoog can be used — the list is not hardcoded.

## Why this approach?

- **No extra Firefox profile needed** — uses the same browser/extension as degoog
- **No separate server needed** — runs as a plugin inside degoog
- **Transport selectable per request** — switch between 4play, curl, etc. without code changes
- **No hardcoded transport list** — any installed degoog transport works
- **Undetectable** — the 4play transport uses real Firefox extension APIs, no webdriver signals
- **Simple** — one plugin file, no external services

## Files

| File | Description |
|------|-------------|
| `plugins/degoog-web-loader/index.mjs` | The degoog plugin |
| `package.json` | degoog store manifest |

## License

AGPL-3.0-only