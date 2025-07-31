# External HTTP Request Blocking

This guide explains how to block external HTTP requests while keeping your BioSense Signal application functional.

## Overview

Your BioSense Signal application requires access to `api.biosensesignal.com` to function properly, but you want to block other external HTTP requests. This implementation provides multiple layers of protection:

1. **Service Worker** - Intercepts requests at the browser level
2. **React Hook** - Blocks requests at the JavaScript level
3. **Webpack Proxy** - Blocks requests at the development server level

## Quick Start

The external request blocking is already configured and active. The following endpoints are **allowed**:

✅ **Allowed Requests:**
- `api.biosensesignal.com` - Required for BioSense functionality
- `biosensesignal.com` - Main domain
- Same-origin requests (your app's domain)
- Local development servers (localhost, 127.0.0.1, etc.)
- Static resources (.js, .css, .png, .jpg, etc.)

🚫 **Blocked Requests:**
- All other external APIs and services
- Tracking scripts
- Analytics services
- Third-party APIs (unless specifically allowed)

## Implementation Details

### 1. Service Worker (Browser Level)

File: `src/sw-external-blocker.js`

- Intercepts all network requests
- Allows essential domains and static resources
- Returns mock responses for blocked requests
- Works even when JavaScript is disabled

**Registration:**
```typescript
// Automatically registered in src/index.tsx
navigator.serviceWorker.register('/sw-external-blocker.js')
```

### 2. React Hook (Application Level)

File: `src/hooks/useExternalRequestBlocker.ts`

- Overrides `fetch()` and `XMLHttpRequest`
- Provides detailed logging and statistics
- Configurable blocking modes

**Usage:**
```typescript
import { useExternalRequestBlocker } from '../hooks';

const { getStats, resetStats } = useExternalRequestBlocker({
  enabled: true,
  blockMode: 'mock', // 'block' | 'mock' | 'log'
  allowStaticResources: true,
  allowedExternalDomains: [
    'api.biosensesignal.com',
    'biosensesignal.com',
  ],
  onExternalBlocked: (url, method) => {
    console.log(`🚫 Blocked: ${method} ${url}`);
  },
});
```

### 3. Webpack Proxy (Development Server)

File: `webpack.config.js`

- Blocks external requests at the server level
- Only active during development
- Provides server-side request filtering

## Configuration

### Adding Allowed Domains

To allow additional external domains, update these files:

**1. Service Worker:**
```javascript
// src/sw-external-blocker.js
const ALLOWED_EXTERNAL_DOMAINS = [
  'api.biosensesignal.com',
  'biosensesignal.com',
  'your-new-domain.com', // Add here
];
```

**2. React Hook:**
```typescript
// src/components/App.tsx
allowedExternalDomains: [
  'api.biosensesignal.com',
  'biosensesignal.com',
  'your-new-domain.com', // Add here
],
```

**3. Webpack Proxy:**
```javascript
// webpack.config.js
const allowedExternalDomains = [
  'api.biosensesignal.com',
  'biosensesignal.com',
  'your-new-domain.com', // Add here
];
```

### Blocking Modes

The React hook supports three blocking modes:

- **`'mock'`** (default): Returns fake successful responses
- **`'block'`**: Throws errors for blocked requests
- **`'log'`**: Logs blocked requests but allows them through

## Testing

A test component is included for development:

```typescript
// Automatically shown in development mode
<NetworkBlockingTest enabled={process.env.NODE_ENV === 'development'} />
```

**Test Features:**
- Tests BioSense API access (should be allowed)
- Tests external APIs (should be blocked)
- Visual feedback with color-coded results
- Real-time testing of blocking functionality

## Console Logging

The blocking system provides detailed console logging:

```
🔒 External Request Blocker Service Worker installed
✅ Allowed request: GET https://api.biosensesignal.com/
🚫 Blocked external request: GET https://tracking-service.com/
📊 Request blocking stats: { externalBlocked: 5, internalAllowed: 12, externalAllowed: 2 }
```

## Production Deployment

### Build Process

The service worker is automatically copied during build:

```bash
npm run build
```

### Files Included in Build:
- `dist/sw-external-blocker.js` - Service worker
- All application files with blocking enabled

### Verification

After deployment, verify blocking is working:

1. Open browser developer tools
2. Check the Console tab for blocking messages
3. Check the Network tab for blocked requests
4. Verify your app still connects to `api.biosensesignal.com`

## Troubleshooting

### App Not Working?

1. **Check Console**: Look for error messages about blocked requests
2. **Verify API Access**: Ensure `api.biosensesignal.com` requests are going through
3. **Service Worker**: Check if the service worker is registered properly

### Adding New Essential Domains

If your app needs access to additional external services:

1. Add the domain to all three configuration locations
2. Test thoroughly to ensure functionality
3. Update this documentation

### Debugging Blocked Requests

```javascript
// Get blocking statistics
const stats = useExternalRequestBlocker().getStats();
console.log('Blocking stats:', stats);

// Monitor specific requests
fetch('https://example.com/api').catch(err => {
  console.log('Request was blocked:', err.message);
});
```

## Security Considerations

### Benefits:
- Prevents data exfiltration to unauthorized servers
- Blocks tracking and analytics scripts
- Reduces attack surface from external services
- Maintains app functionality for essential services

### Limitations:
- Only works for HTTP requests made through JavaScript
- Does not block browser-initiated requests (images, scripts loaded via HTML)
- Can be bypassed if JavaScript is modified
- Development tools can disable service workers

## Browser Compatibility

- **Service Worker**: Modern browsers (Chrome 45+, Firefox 44+, Safari 11.1+)
- **React Hook**: All JavaScript-enabled browsers
- **Webpack Proxy**: Development only

## Performance Impact

- **Minimal**: Service workers run in background threads
- **Positive**: Blocked requests don't consume network bandwidth
- **Logging**: Console logging may impact performance in development

---

## Summary

This implementation successfully blocks external HTTP requests while ensuring your BioSense Signal application can access `api.biosensesignal.com` and continue functioning normally. The multi-layered approach provides robust protection across different scenarios and environments.