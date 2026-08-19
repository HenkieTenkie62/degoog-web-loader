# degoog-web-loader

Open WebUI external web loader plugin for [degoog](https://github.com/degoog-org/degoog).

This plugin exposes an HTTP endpoint that Open WebUI can use as an external web loader. It uses `ctx.fetch()` which routes through the degoog transport layer — so you can pick any transport (4play browser, curl, etc.) for fetching pages.

## Architecture

```
[Firefox - één profiel]
  └── lolcat/4play extensie → ws://127.0.0.1:4444/ws/.../cnc

[degoog container :4444]
  ├── degoog HTTP API (SearXNG shape) → Open WebUI web search
  ├── transports (4play browser, curl, ...)
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

### 2. Configure the plugin

In degoog, go to **Settings → Plugins → Degoog Web Loader** and set:

- **API Key**: Generate a strong random key (e.g. `openssl rand -hex 32`)
- **Transport**: Which degoog transport to use for fetching pages
  - `default` — degoog's default `ctx.fetch`
  - `4play` — real Firefox browser via the 4play transport
  - `curl` — shell out to system `curl`
  - `auto` — try `ctx.fetch` first, fall back to `curl`

### 3. Configure Open WebUI

In Open WebUI, set the following environment variables (or via Admin Panel → Settings → Web Search):

```
WEB_LOADER_ENGINE=external
EXTERNAL_WEB_LOADER_URL=http://<degoog-host>:4444/api/plugin/<plugin-id>/fetch
EXTERNAL_WEB_LOADER_API_KEY=<your-api-key>
```

Replace `<plugin-id>` with the actual plugin folder ID (e.g. `degoog-web-loader`).

## How it works

1. Open WebUI sends a POST request to the plugin's `/fetch` endpoint with:
   ```json
   {
     "urls": ["https://example.com", "https://foo.org"]
   }
   ```
   and header `Authorization: Bearer <api-key>`

2. The plugin fetches each URL through the selected transport

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

## Why this approach?

- **No extra Firefox profile needed** — uses the same browser/extension as degoog
- **No separate server needed** — runs as a plugin inside degoog
- **Transport selectable** — switch between 4play (browser), curl, or auto without code changes
- **Undetectable** — the 4play transport uses real Firefox extension APIs, no webdriver signals
- **Simple** — one plugin file, no external services

## Files

| File | Description |
|------|-------------|
| `plugins/degoog-web-loader/index.mjs` | The degoog plugin |
| `package.json` | degoog store manifest |

## License

AGPL-3.0-only