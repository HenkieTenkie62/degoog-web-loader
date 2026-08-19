/**
 * degoog-web-loader - Degoog plugin
 *
 * Exposes an HTTP endpoint that Open WebUI can use as an external web loader.
 * Fetches pages through degoog's transport layer (4play, curl, etc.) or
 * falls back to plain HTTP fetch.
 *
 * Install: copy this folder to data/plugins/degoog-web-loader/
 *
 * Request:  POST /api/plugin/degoog-web-loader/fetch
 * Body:     { "urls": ["https://example.com"], "transport": "4play" }
 * Response: [{ "page_content": "...", "metadata": { "source": "...", "title": "...", "description": "..." } }]
 */

let _outgoingFetch = null;
let _outgoingFetchTried = false;

/**
 * Try to load degoog's outgoingFetch so we can route requests
 * through any installed transport (4play, curl, flaresolverr, etc.).
 * The plugin lives in data/plugins/<name>/ and degoog's source is in src/.
 */
async function getOutgoingFetch() {
  if (_outgoingFetchTried) return _outgoingFetch;
  _outgoingFetchTried = true;

  const candidates = [
    "../../../src/server/utils/outgoing.ts",
    "../../src/server/utils/outgoing.ts",
    "../src/server/utils/outgoing.ts",
  ];

  for (const rel of candidates) {
    try {
      const mod = await import(new URL(rel, import.meta.url));
      if (typeof mod.outgoingFetch === "function") {
        _outgoingFetch = mod.outgoingFetch;
        return _outgoingFetch;
      }
    } catch {
      /* try next path */
    }
  }
  return null;
}

/**
 * Fetch a URL. If a transport name is given and degoog's outgoingFetch
 * is available, route through that transport. Otherwise use global fetch.
 */
async function fetchUrl(url, transport) {
  if (transport) {
    const of = await getOutgoingFetch();
    if (of) {
      try {
        const res = await of(url, { redirect: "follow" }, transport);
        if (res.ok) return await res.text();
        throw new Error("HTTP " + res.status);
      } catch (e) {
        console.warn(
          "[degoog-web-loader] transport '" + transport + "' failed, falling back to fetch: " + e.message,
        );
      }
    }
  }

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.text();
}

export default {
  routes: [
    {
      method: "post",
      path: "/fetch",
      handler: async (req) => {
        let body;
        try {
          body = await req.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const urls = Array.isArray(body.urls) ? body.urls : [];
        if (urls.length === 0) return json({ error: "No URLs provided" }, 400);

        // Transport priority: request body > URL query param > default fetch.
        // Open WebUI only sends { urls }, so the query param is how you
        // pin a transport: .../fetch?transport=<transport-id>
        let transport = typeof body.transport === "string" ? body.transport.trim() : "";
        if (!transport) {
          try {
            transport = new URL(req.url).searchParams.get("transport") || "";
          } catch {
            /* ignore malformed URL */
          }
        }

        const results = [];
        for (const url of urls) {
          try {
            const html = await fetchUrl(url, transport);
            if (!html) continue;
            results.push({
              page_content: extractText(html),
              metadata: {
                source: url,
                title: extractTitle(html),
                description: extractDescription(html),
              },
            });
          } catch (err) {
            console.warn("[degoog-web-loader] " + url + ": " + err.message);
          }
        }

        return json(results, 200);
      },
    },
  ],
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractText(html) {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, " ")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, " ")
    .replace(/<video\b[^<]*(?:(?!<\/video>)<[^<]*)*<\/video>/gi, " ")
    .replace(/<audio\b[^<]*(?:(?!<\/audio>)<[^<]*)*<\/audio>/gi, " ")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ")
    .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, " ")
    .replace(/<input\b[^<]*(?:(?!<\/input>)<[^<]*)*<\/input>/gi, " ")
    .replace(/<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi, " ")
    .replace(/<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi, " ");

  text = text.replace(/<[^>]+>/g, " ");

  const entities = {
    "\u0026nbsp;": " ",
    "\u0026amp;": "\u0026",
    "\u0026lt;": "\u003c",
    "\u0026gt;": "\u003e",
    "\u0026quot;": "\u0022",
    "\u0026#39;": "\u0027",
    "\u0026apos;": "\u0027",
  };
  for (const [entity, replacement] of Object.entries(entities)) {
    text = text.split(entity).join(replacement);
  }

  return text.replace(/\s+/g, " ").trim();
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : "";
}

function extractDescription(html) {
  const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (m) return m[1].trim();
  const m2 = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  return m2 ? m2[1].trim() : "";
}