// Test alle transports van de degoog-web-loader plugin
const BASE = "http://192.168.0.31:4444/api/plugin/henkietenkie62-degoog-web-loader-degoog-web-loader/fetch";

const transports = [
  "", // default (geen transport)
  "fetch",
  "curl",
  "curl-impersonate",
  "curl-fallback",
  "degoog-org-official-extensions-cloakbrowser-transport",
  "degoog-org-official-extensions-flaresolverr-transport",
  "degoog-org-official-extensions-lolcat-4play-transport",
];

const url = "https://example.com";

for (const t of transports) {
  const label = t || "(default)";
  const sep = "=".repeat(60);
  console.log(sep);
  console.log("Transport:", label);
  console.log(sep);
  try {
    const t0 = Date.now();
    const res = await fetch(BASE + (t ? "?transport=" + encodeURIComponent(t) : ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url] }),
    });
    const ms = Date.now() - t0;
    const text = await res.text();
    if (res.ok) {
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      if (Array.isArray(parsed) && parsed.length > 0) {
        const r = parsed[0];
        console.log("OK (" + ms + "ms)");
        console.log("  title:", r.metadata?.title);
        console.log("  content:", (r.page_content || "").slice(0, 100));
      } else {
        console.log("LEGE RESULTAAT (" + ms + "ms):", text.slice(0, 200));
      }
    } else {
      console.log("HTTP " + res.status + " (" + ms + "ms):", text.slice(0, 200));
    }
  } catch (e) {
    console.log("FOUT:", e.message);
  }
}
console.log("\n" + "=".repeat(60));
console.log("Klaar.");