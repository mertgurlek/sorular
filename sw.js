// Cache disabled - always fetch from network
const CACHE_NAME = 'yds-quiz-v4-disabled';

// Install - skip waiting immediately
self.addEventListener('install', event => {
  console.log('SW: Installing (cache disabled)');
  self.skipWaiting();
});

// Activate - delete all old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('SW: Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// No fetch handler - let browser handle all requests directly
// Removing the no-op fetch handler eliminates navigation overhead warning

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
