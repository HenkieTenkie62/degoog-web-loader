/**
 * degoog-web-loader - Degoog plugin
 *
 * Exposes an HTTP endpoint that Open WebUI can use as an external web loader.
 * Fetches pages through a configurable degoog transport (4play, curl, etc.)
 * or falls back to plain HTTP fetch.
 *
 * The plugin appears in the Plugins section with a transport dropdown.
 * The fetch endpoint is at: POST /api/plugin/<id>/fetch
 *
 * Install: copy this folder to data/plugins/degoog-web-loader/
 */

let _fetch = null;
let _transport = "";

/**
 * Fallback transport list, used when degoog's transports registry
 * cannot be imported (e.g. unusual install layout).
 */
const FALLBACK_TRANSPORTS = [
  { id: "fetch", label: "fetch (built-in)" },
  { id: "curl", label: "curl (built-in)" },
  { id: "curl-impersonate", label: "curl-impersonate (built-in)" },
  { id: "curl-fallback", label: "curl-fallback (built-in)" },
  {
    id: "degoog-org-official-extensions-lolcat-4play-transport",
    label: "4play (lolcat) — real Firefox",
  },
  {
    id: "degoog-org-official-extensions-flaresolverr-transport",
    label: "FlareSolverr — Cloudflare bypass",
  },
  {
    id: "degoog-org-official-extensions-cloakbrowser-transport",
    label: "CloakBrowser — stealth Chromium",
  },
];

let _transportOptions = FALLBACK_TRANSPORTS;

function buildSchema() {
  const options = ["", ..._transportOptions.map((t) => t.id)];
  const optionLabels = [
    "(default — plain fetch)",
    ..._transportOptions.map((t) => t.label),
  ];
  return [
    {
      key: "transport",
      label: "Fetch transport",
      type: "select",
      description:
        "Transport used to fetch pages for Open WebUI. " +
        "The 4play transport uses a real Firefox session (best for bot detection).",
      options,
      optionLabels,
      default: "",
    },
  ];
}

/**
 * Try to load degoog's transports registry so the dropdown lists
 * the transports actually installed on this instance.
 */
async function loadTransportOptions() {
  const candidates = [
    "../../../src/server/extensions/transports/registry.ts",
    "../../src/server/extensions/transports/registry.ts",
    "../src/server/extensions/transports/registry.ts",
  ];
  for (const rel of candidates) {
    try {
      const mod = await import(new URL(rel, import.meta.url));
      if (typeof mod.getTransportExtensionMeta === "function") {
        const metas = await mod.getTransportExtensionMeta();
        if (Array.isArray(metas) && metas.length > 0) {
          _transportOptions = metas.map((m) => ({
            id: m.id,
            label: m.displayName || m.id,
          }));
          command.settingsSchema = buildSchema();
          console.log(
            "[degoog-web-loader] loaded " + _transportOptions.length + " transports from degoog registry",
          );
          return;
        }
      }
    } catch {
      /* try next path */
    }
  }
  console.log(
    "[degoog-web-loader] transports registry not found, using fallback list",
  );
}

/**
 * BangCommand export — makes the plugin appear in the Plugins section
 * with a settings UI. The commands registry calls initPlugin() which
 * invokes init(ctx) and configure(settings).
 */
const command = {
  name: "Degoog Web Loader",
  trigger: "webloader",
  description:
    "Open WebUI external web loader. Configure the transport used for fetching pages.",
  isClientExposed: false,

  settingsSchema: buildSchema(),

  init(ctx) {
    _fetch = ctx.fetch;
    loadTransportOptions().catch(() => {});
  },

  configure(settings) {
    _transport = (settings.transport || "").trim();
  },

  isConfigured() {
    return true;
  },

  async execute() {
    return "Degoog Web Loader is active. Transport: " + (_transport || "default");
  },
};

/**
 * Fetch a URL with a specific transport.
 */
async function fetchUrlWithTransport(url, transport) {
  if (transport && _fetch) {
    try {
      const res = await _fetch(url, { redirect: "follow" }, transport);
      if (res.ok) return await res.text();
      throw new Error("HTTP " + res.status);
    } catch (e) {
      console.warn(
        "[degoog-web-loader] transport '" + transport + "' failed, falling back to fetch: " + e.message,
      );
    }
  }

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.text();
}

export default command;

export const routes = [
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

      // Transport priority: request body > URL query param > plugin setting.
      // Open WebUI only sends { urls }, so the plugin setting is the primary
      // way to pin a transport.
      let transport = _transport;
      if (typeof body.transport === "string" && body.transport.trim()) {
        transport = body.transport.trim();
      } else {
        try {
          const qp = new URL(req.url).searchParams.get("transport");
          if (qp) transport = qp;
        } catch {
          /* ignore malformed URL */
        }
      }

      const results = [];
      for (const url of urls) {
        try {
          const html = await fetchUrlWithTransport(url, transport);
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
];

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