const VERSION = "202610311100";
const FONTS = "lt-fonts";   // never deleted: fonts are downloaded once, not on every update
const CACHE = "lectures-" + VERSION;
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./icon-maskable-512.png"];


// اللون المختار بيتحفظ من الصفحة، والـ manifest والأيقونات بتتبني منه هنا
const DEF = { main: "#2f3e50", on: "#ffffff", bg: "#f1f3f5", acc: "#c98a00" };
async function pal() {
  try { const c = await caches.open("lt-pref"); const r = await c.match("./__pal"); if (r) return Object.assign({}, DEF, await r.json()); } catch (e) {}
  return DEF;
}
async function manifestResp() {
  const p = await pal();
  const m = { name: "منجز", short_name: "منجز", description: "منجز: متابعة المحاضرات والعبادات والأذكار ومواعيد الصلاة",
    lang: "ar", dir: "rtl", start_url: "./index.html", scope: "./", display: "standalone", orientation: "portrait",
    background_color: "#1b2736", theme_color: p.bg,
    icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
  return new Response(JSON.stringify(m), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" } });
}
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "lt-pref" && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  // طلبات جوجل (تسجيل الدخول والـ Drive) تعدّي من غير تخزين؛ الخطوط بس هي اللي بتتخزّن
  if (!same && url.hostname !== "fonts.googleapis.com" && url.hostname !== "fonts.gstatic.com") return;
  if (!same) {   // الخطوط: من المخزن الدايم أولاً، وبتتحمّل مرة واحدة بس
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && (r.status === 200 || r.type === "opaque")) c.put(req, r.clone());
      return r;
    }))));
    return;
  }
  if (same && url.pathname.endsWith("/manifest.webmanifest")) { e.respondWith(manifestResp()); return; }
  const isDoc = req.mode === "navigate" || (same && (url.pathname.endsWith("/") || url.pathname.endsWith("index.html") || url.pathname.endsWith("manifest.webmanifest")));

  // الصفحة نفسها: الأحدث من الإنترنت أولاً، ولو مفيش نت تفتح آخر نسخة محفوظة
  if (isDoc) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
        .catch(() => caches.match(req).then(h => h || caches.match("./index.html")))
    );
    return;
  }

  // باقي الملفات (الأيقونات والخطوط): من الحفظ أولاً
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && (r.status === 200 || r.type === "opaque")) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return r;
    }))
  );
});
