// Service Worker — Akıllı Cache Stratejisi
const CACHE_VERSION = 'v5';
const STATIC_CACHE = `yds-static-${CACHE_VERSION}`;
const API_CACHE = `yds-api-${CACHE_VERSION}`;

// Statik asset'ler — Stale-While-Revalidate
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/src/utils/constants.js',
  '/src/utils/storage.js',
  '/src/utils/api.js',
  '/src/utils/helpers.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install — precache statik asset'ler
self.addEventListener('install', event => {
  console.log('SW: Installing with cache strategy');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — eski cache versiyonlarını temizle
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== API_CACHE)
          .map(name => {
            console.log('SW: Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — strateji seçimi
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // POST isteklerini ve auth endpoint'lerini cache'leme
  if (event.request.method !== 'GET') return;
  
  // API istekleri — Network-First (offline fallback)
  if (url.pathname.startsWith('/api/')) {
    // Kullanıcı verilerini cache'leme (güvenlik)
    if (url.pathname.includes('/user/')) return;
    
    event.respondWith(networkFirstWithCache(event.request, API_CACHE));
    return;
  }
  
  // Harici kaynaklar (Google Fonts, CDN) — Cache-First
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirstWithNetwork(event.request, STATIC_CACHE));
    return;
  }
  
  // Statik asset'ler — Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
});

// Stale-While-Revalidate: Hızlı cache yanıtı + arka planda güncelleme
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise;
}

// Network-First: Önce ağ, başarısız olursa cache
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Çevrimdışı — cache bulunamadı' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache-First: Önce cache, yoksa ağ
async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) return cachedResponse;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('', { status: 503 });
  }
}

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  // Cache temizleme komutu
  if (event.data.action === 'clearCache') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});
