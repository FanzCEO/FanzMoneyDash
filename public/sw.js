/**
 * FANZ Money Dash - Service Worker
 * Progressive Web App functionality for offline use
 */

const CACHE_NAME = 'fanz-money-dash-v1.0.0';
const API_CACHE_NAME = 'fanz-api-cache-v1.0.0';

// Files to cache for offline functionality
const STATIC_CACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API endpoints to cache
const API_CACHE_URLS = [
  '/api/docs',
  '/health'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      }),
      caches.open(API_CACHE_NAME).then((cache) => {
        console.log('📦 Caching API endpoints');
        return cache.addAll(API_CACHE_URLS);
      })
    ]).then(() => {
      console.log('✅ Service Worker installed successfully');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle static file requests
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // If successful, update cache and return response
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving API from cache:', request.url);
      return cachedResponse;
    }
    
    // If no cache, return network response (even if not ok)
    return networkResponse;
    
  } catch (error) {
    console.log('❌ Network failed, trying cache for:', request.url);
    
    // Network completely failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for failed API requests
    return new Response(JSON.stringify({
      success: false,
      error: 'Offline - API not available',
      offline: true
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // If not in cache, try network
    const networkResponse = await fetch(request);
    
    // If successful, add to cache
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('❌ Network failed for:', request.url);
    
    // If requesting HTML page, return offline page
    if (request.headers.get('Accept')?.includes('text/html')) {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // For other resources, return error
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle background sync (for future implementation)
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'financial-data-sync') {
    event.waitUntil(syncFinancialData());
  }
});

// Handle push notifications (for future implementation)
self.addEventListener('push', (event) => {
  console.log('📧 Push notification received');
  
  const options = {
    body: 'You have new financial updates',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'financial-update',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View Dashboard'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  if (event.data) {
    const data = event.data.json();
    options.body = data.message || options.body;
    options.tag = data.tag || options.tag;
  }
  
  event.waitUntil(
    self.registration.showNotification('FANZ Money Dash', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Sync financial data in background
async function syncFinancialData() {
  try {
    console.log('🔄 Syncing financial data...');
    
    // Fetch latest financial data
    const response = await fetch('/api/analytics/insights');
    
    if (response.ok) {
      const data = await response.json();
      
      // Store in IndexedDB or send to open tabs
      const clientList = await clients.matchAll();
      clientList.forEach(client => {
        client.postMessage({
          type: 'FINANCIAL_DATA_SYNC',
          data: data
        });
      });
      
      console.log('✅ Financial data synced');
    }
  } catch (error) {
    console.error('❌ Failed to sync financial data:', error);
  }
}