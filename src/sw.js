// Service Worker to block HTTP requests while keeping app functional
const ALLOWED_DOMAINS = [
  // Allow localhost and development servers
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  // Allow webpack dev server
  location.hostname,
  // Add any essential domains your app needs
  // 'api.yourdomain.com',
];

const ALLOWED_PATHS = [
  // Allow static assets
  /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
  // Allow webpack hot reload
  /webpack-dev-server/,
  /hot-update/,
  // Allow your app's static files
  /static\//,
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Allow same-origin requests
  if (url.origin === location.origin) {
    return;
  }
  
  // Allow requests to allowed domains
  const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
    url.hostname.includes(domain)
  );
  
  // Allow requests to allowed paths
  const isAllowedPath = ALLOWED_PATHS.some(pattern => 
    pattern.test(url.pathname)
  );
  
  // Block external HTTP requests
  if (!isAllowedDomain && !isAllowedPath) {
    console.log('Blocked request to:', event.request.url);
    
    // Return a mock response to prevent errors
    event.respondWith(
      new Response(JSON.stringify({ blocked: true, reason: 'HTTP request blocked' }), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    return;
  }
  
  // Allow the request to proceed
  console.log('Allowed request to:', event.request.url);
});