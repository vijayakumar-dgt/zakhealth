import { useEffect } from 'react';

interface BlockerConfig {
  allowedDomains?: string[];
  allowedPaths?: RegExp[];
  blockMode?: 'block' | 'mock' | 'log';
  onBlocked?: (url: string, method: string) => void;
}

const useNetworkBlocker = (config: BlockerConfig = {}) => {
  const {
    allowedDomains = ['localhost', '127.0.0.1', window.location.hostname],
    allowedPaths = [
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
      /webpack-dev-server/,
      /hot-update/,
    ],
    blockMode = 'mock',
    onBlocked,
  } = config;

  useEffect(() => {
    // Store original functions
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    const isAllowedRequest = (url: string): boolean => {
      try {
        const urlObj = new URL(url, window.location.origin);
        
        // Allow same-origin requests
        if (urlObj.origin === window.location.origin) {
          return true;
        }
        
        // Check allowed domains
        const isDomainAllowed = allowedDomains.some(domain => 
          urlObj.hostname.includes(domain)
        );
        
        // Check allowed paths
        const isPathAllowed = allowedPaths.some(pattern => 
          pattern.test(urlObj.pathname)
        );
        
        return isDomainAllowed || isPathAllowed;
      } catch (e) {
        return false;
      }
    };

    // Override fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      
      if (!isAllowedRequest(url)) {
        const method = init?.method || 'GET';
        console.log(`🚫 Blocked ${method} request to: ${url}`);
        
        onBlocked?.(url, method);
        
        if (blockMode === 'block') {
          throw new Error(`Request to ${url} was blocked`);
        } else if (blockMode === 'mock') {
          return new Response(
            JSON.stringify({ 
              blocked: true, 
              url, 
              message: 'Request blocked by network interceptor' 
            }),
            {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } else {
          // log mode - allow but log
          console.warn(`⚠️ Would block ${method} request to: ${url}`);
        }
      }
      
      return originalFetch(input, init);
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
      
      if (!isAllowedRequest(urlString)) {
        console.log(`🚫 Blocked XMLHttpRequest ${method} to: ${urlString}`);
        
        onBlocked?.(urlString, method);
        
        if (blockMode === 'block') {
          throw new Error(`XMLHttpRequest to ${urlString} was blocked`);
        } else if (blockMode === 'mock') {
          // Store the original open call but we'll mock the response
          this._blockedRequest = { method, url: urlString };
        } else {
          console.warn(`⚠️ Would block XMLHttpRequest ${method} to: ${urlString}`);
        }
      }
      
      return originalXHROpen.call(this, method, url, async, user, password);
    };

    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      if (this._blockedRequest && blockMode === 'mock') {
        // Mock the response for blocked requests
        setTimeout(() => {
          Object.defineProperty(this, 'readyState', { writable: true });
          Object.defineProperty(this, 'status', { writable: true });
          Object.defineProperty(this, 'statusText', { writable: true });
          Object.defineProperty(this, 'responseText', { writable: true });
          Object.defineProperty(this, 'response', { writable: true });
          
          this.readyState = 4;
          this.status = 200;
          this.statusText = 'OK';
          this.responseText = JSON.stringify({ 
            blocked: true, 
            url: this._blockedRequest.url,
            message: 'Request blocked by network interceptor' 
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
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
      XMLHttpRequest.prototype.send = originalXHRSend;
    };
  }, [allowedDomains, allowedPaths, blockMode, onBlocked]);
};

export default useNetworkBlocker;