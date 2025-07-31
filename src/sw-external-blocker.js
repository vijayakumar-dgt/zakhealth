// Service Worker to block EXTERNAL HTTP requests only
const INTERNAL_DOMAINS = [
  // Local development
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  // Current domain
  self.location.hostname,
  // Local network ranges (for mobile testing)
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
];

const ALLOWED_EXTERNAL_DOMAINS = [
  // Add any specific external domains you need to allow
  // 'cdn.jsdelivr.net',
  // 'fonts.googleapis.com',
  // 'api.yourdomain.com',
];

const STATIC_RESOURCE_PATTERNS = [
  // Allow static assets regardless of domain
  /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|avif)$/i,
  /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i, // media files
  /\.(json|xml|txt)$/i, // data files
];

const DEV_PATTERNS = [
  // Webpack dev server patterns
  /webpack-dev-server/,
  /hot-update/,
  /__webpack_hmr/,
  /sockjs-node/,
];

function isInternalDomain(hostname) {
  return INTERNAL_DOMAINS.some(domain => {
    if (typeof domain === 'string') {
      return hostname === domain || hostname.endsWith('.' + domain);
    } else if (domain instanceof RegExp) {
      return domain.test(hostname);
    }
    return false;
  });
}

function isAllowedExternalDomain(hostname) {
  return ALLOWED_EXTERNAL_DOMAINS.some(domain => {
    if (typeof domain === 'string') {
      return hostname === domain || hostname.endsWith('.' + domain);
    } else if (domain instanceof RegExp) {
      return domain.test(hostname);
    }
    return false;
  });
}

function isStaticResource(url) {
  return STATIC_RESOURCE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isDevResource(url) {
  return DEV_PATTERNS.some(pattern => pattern.test(url.pathname + url.search));
}

function shouldBlockExternalRequest(requestUrl) {
  const url = new URL(requestUrl);
  
  // Always allow same-origin requests
  if (url.origin === self.location.origin) {
    return false;
  }
  
  // Allow internal/local domains
  if (isInternalDomain(url.hostname)) {
    return false;
  }
  
  // Allow specifically whitelisted external domains
  if (isAllowedExternalDomain(url.hostname)) {
    return false;
  }
  
  // Allow static resources (CDNs, fonts, etc.)
  if (isStaticResource(url)) {
    return false;
  }
  
  // Allow development resources
  if (isDevResource(url)) {
    return false;
  }
  
  // Block everything else (external API calls, tracking, etc.)
  return true;
}

self.addEventListener('install', (event) => {
  console.log('🔒 External Request Blocker Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🔒 External Request Blocker Service Worker activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;
  
  try {
    if (shouldBlockExternalRequest(requestUrl)) {
      console.log('🚫 Blocked external request:', event.request.method, requestUrl);
      
      // Return a mock response for blocked external requests
      event.respondWith(
        new Response(
          JSON.stringify({
            blocked: true,
            reason: 'External HTTP request blocked',
            url: requestUrl,
            method: event.request.method,
            timestamp: new Date().toISOString(),
            message: 'This external request was blocked by the service worker'
          }),
          {
            status: 200,
            statusText: 'Blocked',
            headers: {
              'Content-Type': 'application/json',
              'X-Blocked-By': 'External-Request-Blocker',
            },
          }
        )
      );
      return;
    }
    
    // Allow the request to proceed normally
    console.log('✅ Allowed request:', event.request.method, requestUrl);
    
  } catch (error) {
    console.error('Error in service worker:', error);
    // If there's an error, allow the request to proceed
  }
});