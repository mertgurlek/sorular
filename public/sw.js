const CACHE_NAME = 'yds-quiz-v2';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './yds_questions/adjectives_adverbs.json',
  './yds_questions/conjunctions.json',
  './yds_questions/gerunds_infinitives.json',
  './yds_questions/grammar_revision.json',
  './yds_questions/if_clauses.json',
  './yds_questions/modals.json',
  './yds_questions/noun_clauses.json',
  './yds_questions/nouns.json',
  './yds_questions/passive.json',
  './yds_questions/reductions.json',
  './yds_questions/relative_clauses.json',
  './yds_questions/tenses.json'
];

// Install event - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return Promise.all(
          urlsToCache.map(async (url) => {
            try {
              await cache.add(url);
            } catch (err) {
              console.log('Cache add failed for:', url, err);
            }
          })
        );
      })
      .catch(err => {
        console.log('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip caching for API requests
  if (url.pathname.startsWith('/api') || event.request.url.includes('localhost:3001')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(response => {
          // Don't cache non-successful responses or non-GET requests
          if (!response || response.status !== 200 || event.request.method !== 'GET') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
      .catch(() => {
        // Return offline fallback if available
        return caches.match('./index.html');
      })
  );
});

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
