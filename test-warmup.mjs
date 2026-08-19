// Test warmup hergebruik: nos.nl 3x opeenvolgend
const BASE = "http://192.168.0.31:4444/api/plugin/henkietenkie62-degoog-web-loader-degoog-web-loader/fetch";
const TRANSPORT = "degoog-org-official-extensions-lolcat-4play-transport";
const url = "https://nos.nl";

for (let i = 1; i <= 3; i++) {
  const sep = "=".repeat(70);
  console.log(sep);
  console.log("Request #" + i + ": " + url);
  console.log(sep);
  try {
    const t0 = Date.now();
    const res = await fetch(BASE + "?transport=" + encodeURIComponent(TRANSPORT), {
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
        console.log("OK (" + (ms/1000).toFixed(1) + "s)");
        console.log("  title:", r.metadata?.title);
        console.log("  content length:", (r.page_content || "").length);
      } else {
        console.log("LEGE RESULTAAT (" + (ms/1000).toFixed(1) + "s)");
      }
    } else {
      console.log("HTTP " + res.status + " (" + (ms/1000).toFixed(1) + "s)");
    }
  } catch (e) {
    console.log("FOUT:", e.message);
  }
  console.log();
}
console.log("=".repeat(70));
console.log("Klaar.");