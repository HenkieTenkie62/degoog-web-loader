/**
 * degoog-web-loader - Degoog plugin
 * 
 * Exposes an HTTP endpoint that Open WebUI can use as an external web loader.
 * Uses ctx.fetch() which routes through the degoog transport layer.
 * 
 * Install: copy this folder to data/plugins/degoog-web-loader/
 */

let apiBase = "";
let apiKey = "";
let fetchFn = null;
let transport = "default";

export default {
  name: "degoog-web-loader",
  description: "Open WebUI external web loader via degoog transports",
  isClientExposed: false,

  settingsSchema: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      secret: true,
      required: true,
      description: "Key that Open WebUI sends as Bearer token",
    },
    {
      key: "transport",
      label: "Transport",
      type: "select",
      required: true,
      default: "default",
      description: "Which degoog transport to use for fetching pages",
      options: [
        { value: "default", label: "Default (fetch)" },
        { value: "4play", label: "4play (browser)" },
        { value: "curl", label: "curl" },
        { value: "auto", label: "Auto (fetch + curl fallback)" },
      ],
    },
  ],

  configure(settings) {
    apiKey = (settings.apiKey || "").trim();
    transport = (settings.transport || "default").trim();
  },

  isConfigured() {
    return apiKey.length > 0;
  },

  init(ctx) {
    apiBase = ctx.apiBase;
    fetchFn = ctx.fetch;
  },

  routes: [
    {
      method: "post",
      path: "/fetch",
      handler: async (req) => {
        // Validate API key
        const authHeader = req.headers.get("authorization") || "";
        const expected = "Bearer " + apiKey;
        if (authHeader !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Parse request body
        let body;
        try {
          body = await req.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const urls = Array.isArray(body.urls) ? body.urls : [];
        if (urls.length === 0) {
          return new Response(JSON.stringify({ error: "No URLs provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Fetch each URL through the selected transport
        const results = [];
        for (const url of urls) {
          try {
            const html = await fetchWithTransport(url);
            if (!html) {
              console.warn("[degoog-web-loader] Failed to fetch " + url);
              continue;
            }

            // Extract text content from HTML
            const text = extractText(html);
            const title = extractTitle(html);
            const description = extractDescription(html);

            results.push({
              page_content: text,
              metadata: {
                source: url,
                title: title,
                description: description,
              },
            });
          } catch (err) {
            console.warn("[degoog-web-loader] Error fetching " + url + ": " + err.message);
          }
        }

        return new Response(JSON.stringify(results), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  ],
};

/**
 * Fetch a URL using the selected transport.
 * Falls back to ctx.fetch (default) if the transport is not available.
 */
async function fetchWithTransport(url) {
  switch (transport) {
    case "4play":
      // ctx.fetch routes through the degoog transport layer.
      // If the 4play transport is selected for the plugin's requests,
      // it will use the real browser. Otherwise it falls back to default.
      return fetchViaCtx(url);

    case "curl":
      // Try curl first, fall back to ctx.fetch
      try {
        const html = await fetchViaCurl(url);
        if (html) return html;
      } catch (e) {
        console.warn("[degoog-web-loader] curl failed, falling back to fetch: " + e.message);
      }
      return fetchViaCtx(url);

    case "auto":
      // Try ctx.fetch first, fall back to curl on failure
      try {
        const html = await fetchViaCtx(url);
        if (html) return html;
      } catch (e) {
        console.warn("[degoog-web-loader] fetch failed, trying curl: " + e.message);
      }
      return fetchViaCurl(url);

    case "default":
    default:
      return fetchViaCtx(url);
  }
}

/**
 * Fetch via ctx.fetch (degoog's proxy-aware fetch).
 */
async function fetchViaCtx(url) {
  const res = await fetchFn(url, {
    method: "GET",
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }

  return await res.text();
}

/**
 * Fetch via curl (shell out to system curl).
 */
async function fetchViaCurl(url) {
  // Use Bun's built-in spawn (degoog runs on Bun)
  const proc = Bun.spawn(["curl", "-sL", "--max-time", "30", url], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error("curl exited with code " + exitCode);
  }

  return stdout;
}

/**
 * Extract readable text from HTML.
 */
function extractText(html) {
  // Remove script, style, nav, footer, aside, iframe, noscript
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

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities using unicode escapes to avoid formatter issues
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

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Extract page title from HTML.
 */
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : "";
}

/**
 * Extract meta description from HTML.
 */
function extractDescription(html) {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (match) return match[1].trim();

  const match2 = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  return match2 ? match2[1].trim() : "";
}