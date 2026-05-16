// pokelog-bdsp 用の軽量オフライン Service Worker（依存なし）。
// データは元々 localStorage。ここではアプリシェル（HTML/JS/CSS/フォント/
// アイコン）だけをキャッシュし、初回アクセス後はオフラインで起動できる。
// 更新時は CACHE のバージョン(v1 -> v2 ...)を上げる。

const CACHE = "pokelog-bdsp-shell-v1";
const PRECACHE = ["/", "/ev"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 1 つ失敗しても install を止めない（best-effort）。
      await Promise.allSettled(PRECACHE.map((u) => cache.add(u)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$/.test(
      url.pathname,
    ) ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ページ遷移: network-first → キャッシュ → 最終フォールバック "/"。
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match("/")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // 静的アセット: stale-while-revalidate（即返し＋裏で更新）。
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      })(),
    );
  }
});
