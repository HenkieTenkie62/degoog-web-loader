# owui-web-loader

Open WebUI external web loader using [4play](https://git.lolcat.ca/lolcat/4play) browser automation via a [degoog](https://github.com/degoog-org/degoog) plugin.

This plugin exposes an HTTP endpoint that Open WebUI can use as an external web loader. It uses `ctx.fetch()` which routes through the 4play transport (real Firefox browser) - completely undetectable.

## Architecture

```
[Firefox - één profiel]
  └── lolcat/4play extensie → ws://127.0.0.1:4444/ws/degoog-org-official-extensions-lolcat-4play-transport/cnc

[degoog container :4444]
  ├── degoog HTTP API (SearXNG shape) → Open WebUI web search
  ├── 4play transport (cookie harvesting + URL fetching via ctx.fetch)
  └── owui-web-loader plugin → POST /api/plugin/<id>/fetch

[Open WebUI]
  └── WEB_LOADER_ENGINE=external → http://192.168.0.31:4444/api/plugin/<id>/fetch
```

## Installation

### 1. Install the plugin on degoog

Copy the `degoog-plugin/` folder to the degoog plugins directory:

```bash
# On the machine running degoog
cp -r degoog-plugin/ /path/to/degoog/data/plugins/owui-web-loader/
```

Or via the degoog Store if you publish it.

### 2. Configure the plugin

In degoog, go to **Settings → Plugins → owui-web-loader** and set:
- **API Key**: Generate a strong random key (e.g. `openssl rand -hex 32`)

### 3. Configure Open WebUI

In Open WebUI, set the following environment variables (or via Admin Panel → Settings → Web Search):

```
WEB_LOADER_ENGINE=external
EXTERNAL_WEB_LOADER_URL=http://192.168.0.31:4444/api/plugin/<plugin-id>/fetch
EXTERNAL_WEB_LOADER_API_KEY=<your-api-key>
```

Replace `<plugin-id>` with the actual plugin folder ID (e.g. `owui-web-loader` or `degoog-org-official-extensions-owui-web-loader` if installed from a store).

## How it works

1. Open WebUI sends a POST request to the plugin's `/fetch` endpoint with:
   ```json
   {
     "urls": ["https://example.com", "https://foo.org"]
   }
   ```
   and header `Authorization: Bearer <api-key>`

2. The plugin uses `ctx.fetch()` which routes through the 4play transport (real Firefox browser)

3. For each URL:
   - The 4play transport fetches the page using the real browser session
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

- **No extra Firefox profile needed** - uses the same browser/extension as degoog
- **No separate server needed** - runs as a plugin inside degoog
- **Uses the 4play transport** - `ctx.fetch()` automatically routes through the real browser
- **Containers isolate traffic** - the 4play transport manages containers for different origins
- **Undetectable** - uses real Firefox extension APIs, no webdriver signals
- **Simple** - one plugin file, no external services

## Files

| File | Description |
|------|-------------|
| `degoog-plugin/index.mjs` | The degoog plugin (copy to degoog's `data/plugins/`) |
| `server.js` | Standalone Node.js bridge (alternative approach, not needed if using the plugin) |
| `test-connection.js` | Test script for the standalone bridge |
| `.env.example` | Configuration template for the standalone bridge |

## License

AGPL-3.0-only