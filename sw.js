/* RailSync – service worker: gjør at appen kan åpnes og brukes uten nett.
 *
 * - Appens egne filer (med ?v=versjon) lagres ved installasjon og hentes fra lageret.
 * - Selve siden hentes fra nett først (så nye versjoner kommer med en gang), med lagret kopi som reserve.
 * - Skriften ligger blant appens egne filer. Kart og Firebase-biblioteket (faste versjoner) lagres første gang de brukes.
 * - Kartfliser du har sett, lagres (maks MAX_TILES) så kartet virker uten nett der du har vært.
 * - Firestore, innlogging og togsøk går alltid rett til nett (dataene lagres av appen selv).
 *
 * VERSION settes automatisk ved publisering (.github/workflows/deploy.yml).
 */
const VERSION = "dev";
const SHELL_CACHE = "railsync-shell-" + VERSION;
const LIB_CACHE = "railsync-libs-v1";
const TILE_CACHE = "railsync-tiles-v1";
const MAX_TILES = 600;
const NAV_TIMEOUT_MS = 4000;

const SHELL_FILES = [
  "./",
  "./app.js?v=" + VERSION,
  "./assets/railsync.css?v=" + VERSION,
  "./assets/icons.js?v=" + VERSION,
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/favicon-32.png",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/fonts/plus-jakarta-sans-latin.woff2",
  "./assets/fonts/plus-jakarta-sans-latin-ext.woff2"
];

// Eksterne biblioteker med faste versjoner – trygt å lagre for godt
const LIB_PREFIXES = [
  "https://unpkg.com/leaflet@1.9.4/",
  "https://www.gstatic.com/firebasejs/10.12.0/"
];
const TILE_HOST = /(^|\.)tile\.openstreetmap\.org$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, LIB_CACHE, TILE_CACHE]);
    for (const key of await caches.keys()) {
      if (key.startsWith("railsync-") && !keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(req));
    return;
  }
  if (url.origin === self.location.origin) {
    // Sider hentet med fetch (f.eks. sjekk av ny versjon) skal alltid gå til nett
    if (url.pathname.endsWith("/") || url.pathname.endsWith(".html")) return;
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }
  if (LIB_PREFIXES.some(p => req.url.startsWith(p))) {
    event.respondWith(cacheFirst(req, LIB_CACHE));
    return;
  }
  if (TILE_HOST.test(url.hostname)) {
    event.respondWith(tile(req));
  }
  // Alt annet (Firestore, innlogging, togsøk, stedsøk) går rett til nett.
});

async function networkFirstPage(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT_MS))
    ]);
    if (res && res.ok) cache.put("./", res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match("./") || await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    return new Response("<!doctype html><meta charset=utf-8><title>RailSync</title><p style=\"font-family:sans-serif;padding:2rem\">Du er uten nett, og RailSync er ikke lagret på denne enheten ennå. Åpne siden én gang med nett først.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
  return res;
}

async function tile(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) {
      await cache.put(req, res.clone());
      trimTiles(cache);
    }
    return res;
  } catch (e) {
    return new Response("", { status: 504 });
  }
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}
