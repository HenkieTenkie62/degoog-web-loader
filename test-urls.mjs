// Test specifieke URLs met de 4play transport
const BASE = "http://192.168.0.31:4444/api/plugin/henkietenkie62-degoog-web-loader-degoog-web-loader/fetch";
const TRANSPORT = "degoog-org-official-extensions-lolcat-4play-transport";

const urls = [
  "https://nos.nl",
  "https://www.researchsquare.com/article/rs-66060/latest.pdf",
  "https://cnc.bozemetal.com/blog/titanium-grade-23-vs-grade-5-comparison",
];

for (const url of urls) {
  const sep = "=".repeat(70);
  console.log(sep);
  console.log("URL:", url);
  console.log("Transport:", TRANSPORT);
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
        console.log("OK (" + ms + "ms)");
        console.log("  title:", r.metadata?.title);
        console.log("  description:", r.metadata?.description);
        console.log("  content length:", (r.page_content || "").length);
        console.log("  content preview:", (r.page_content || "").slice(0, 300));
      } else {
        console.log("LEGE RESULTAAT (" + ms + "ms)");
        console.log("  raw:", text.slice(0, 500));
      }
    } else {
      console.log("HTTP " + res.status + " (" + ms + "ms)");
      console.log("  body:", text.slice(0, 500));
    }
  } catch (e) {
    console.log("FOUT:", e.message);
  }
  console.log();
}
console.log("=".repeat(70));
console.log("Klaar.");