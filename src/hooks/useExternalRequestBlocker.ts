import { useEffect, useRef } from 'react';

interface ExternalBlockerConfig {
  enabled?: boolean;
  allowedExternalDomains?: string[];
  allowStaticResources?: boolean;
  blockMode?: 'block' | 'mock' | 'log';
  onExternalBlocked?: (url: string, method: string) => void;
  onInternalAllowed?: (url: string, method: string) => void;
}

interface BlockerStats {
  externalBlocked: number;
  internalAllowed: number;
  externalAllowed: number;
}

const useExternalRequestBlocker = (config: ExternalBlockerConfig = {}) => {
  const {
    enabled = true,
    allowedExternalDomains = [],
    allowStaticResources = true,
    blockMode = 'mock',
    onExternalBlocked,
    onInternalAllowed,
  } = config;

  const statsRef = useRef<BlockerStats>({
    externalBlocked: 0,
    internalAllowed: 0,
    externalAllowed: 0,
  });

  const originalFetchRef = useRef<typeof fetch>();
  const originalXHROpenRef = useRef<typeof XMLHttpRequest.prototype.open>();

  useEffect(() => {
    if (!enabled) return;

    // Store original functions
    originalFetchRef.current = window.fetch;
    originalXHROpenRef.current = XMLHttpRequest.prototype.open;

    const isInternalRequest = (url: string): boolean => {
      try {
        const urlObj = new URL(url, window.location.origin);
        
        // Same origin is always internal
        if (urlObj.origin === window.location.origin) {
          return true;
        }
        
        // Local/development domains
        const internalDomains = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          window.location.hostname,
        ];
        
        // Local network ranges
        const localNetworkPatterns = [
          /^192\.168\./,
          /^10\./,
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        ];
        
        const isLocalDomain = internalDomains.some(domain => 
          urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
        
        const isLocalNetwork = localNetworkPatterns.some(pattern => 
          pattern.test(urlObj.hostname)
        );
        
        return isLocalDomain || isLocalNetwork;
      } catch (e) {
        return false;
      }
    };

    const isAllowedExternalRequest = (url: string): boolean => {
      try {
        const urlObj = new URL(url, window.location.origin);
        
        // Check allowed external domains
        const isDomainAllowed = allowedExternalDomains.some(domain => 
          urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
        
        // Check if it's a static resource
        const isStaticResource = allowStaticResources && /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|avif|mp4|webm|ogg|mp3|wav|flac|aac|json|xml|txt)$/i.test(urlObj.pathname);
        
        return isDomainAllowed || isStaticResource;
      } catch (e) {
        return false;
      }
    };

    const shouldBlockRequest = (url: string): boolean => {
      const isInternal = isInternalRequest(url);
      
      if (isInternal) {
        return false; // Never block internal requests
      }
      
      // For external requests, check if they're allowed
      return !isAllowedExternalRequest(url);
    };

    // Override fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      
      if (shouldBlockRequest(url)) {
        statsRef.current.externalBlocked++;
        console.log(`🚫 Blocked external ${method} request to: ${url}`);
        
        onExternalBlocked?.(url, method);
        
        if (blockMode === 'block') {
          throw new Error(`External request to ${url} was blocked`);
        } else if (blockMode === 'mock') {
          return new Response(
            JSON.stringify({
              blocked: true,
              url,
              method,
              reason: 'External request blocked',
              timestamp: new Date().toISOString(),
              isExternal: !isInternalRequest(url),
            }),
            {
              status: 200,
              statusText: 'Blocked',
              headers: { 
                'Content-Type': 'application/json',
                'X-Request-Blocked': 'true',
              },
            }
          );
        } else {
          // log mode - allow but log
          console.warn(`⚠️ Would block external ${method} request to: ${url}`);
        }
      }
      
      // Allow the request
      if (isInternalRequest(url)) {
        statsRef.current.internalAllowed++;
        onInternalAllowed?.(url, method);
      } else {
        statsRef.current.externalAllowed++;
      }
      
      return originalFetchRef.current!(input, init);
    };

    // Override XMLHttpRequest
    XMLHttpRequest.prototype.open = function(
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string | null,
      password?: string | null
    ) {
      const urlString = url.toString();
      
      if (shouldBlockRequest(urlString)) {
        statsRef.current.externalBlocked++;
        console.log(`🚫 Blocked external XMLHttpRequest ${method} to: ${urlString}`);
        
        onExternalBlocked?.(urlString, method);
        
        if (blockMode === 'block') {
          throw new Error(`External XMLHttpRequest to ${urlString} was blocked`);
        } else if (blockMode === 'mock') {
          // Store blocked request info for mocking
          (this as any)._blockedExternalRequest = { method, url: urlString };
        } else {
          console.warn(`⚠️ Would block external XMLHttpRequest ${method} to: ${urlString}`);
        }
      } else {
        if (isInternalRequest(urlString)) {
          statsRef.current.internalAllowed++;
          onInternalAllowed?.(urlString, method);
        } else {
          statsRef.current.externalAllowed++;
        }
      }
      
      return originalXHROpenRef.current!.call(this, method, url, async, user, password);
    };

    // Override XMLHttpRequest send for mocking blocked requests
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      if ((this as any)._blockedExternalRequest && blockMode === 'mock') {
        // Mock the response
        setTimeout(() => {
          Object.defineProperty(this, 'readyState', { writable: true });
          Object.defineProperty(this, 'status', { writable: true });
          Object.defineProperty(this, 'statusText', { writable: true });
          Object.defineProperty(this, 'responseText', { writable: true });
          Object.defineProperty(this, 'response', { writable: true });
          
          this.readyState = 4;
          this.status = 200;
          this.statusText = 'Blocked';
          this.responseText = JSON.stringify({
            blocked: true,
            url: (this as any)._blockedExternalRequest.url,
            method: (this as any)._blockedExternalRequest.method,
            reason: 'External request blocked',
            timestamp: new Date().toISOString(),
            isExternal: true,
          });
          this.response = this.responseText;
          
          if (this.onreadystatechange) {
            this.onreadystatechange.call(this, new Event('readystatechange'));
          }
          
          if (this.onload) {
            this.onload.call(this, new Event('load'));
          }
        }, 0);
        return;
      }
      
      return originalXHRSend.call(this, body);
    };

    // Cleanup function
    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
      if (originalXHROpenRef.current) {
        XMLHttpRequest.prototype.open = originalXHROpenRef.current;
      }
      XMLHttpRequest.prototype.send = originalXHRSend;
    };
  }, [enabled, allowedExternalDomains, allowStaticResources, blockMode, onExternalBlocked, onInternalAllowed]);

  const getStats = (): BlockerStats => {
    return { ...statsRef.current };
  };

  const resetStats = (): void => {
    statsRef.current = {
      externalBlocked: 0,
      internalAllowed: 0,
      externalAllowed: 0,
    };
  };

  return {
    getStats,
    resetStats,
    isEnabled: enabled,
  };
};

export default useExternalRequestBlocker;