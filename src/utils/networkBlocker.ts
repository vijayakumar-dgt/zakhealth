// Network blocking utility for browser devtools
interface NetworkBlockerUtils {
  blockAll: () => void;
  unblockAll: () => void;
  blockDomain: (domain: string) => void;
  unblockDomain: (domain: string) => void;
  listBlocked: () => string[];
  getStats: () => { blocked: number; allowed: number; };
}

class NetworkBlocker {
  private blockedDomains: Set<string> = new Set();
  private isGloballyBlocked: boolean = false;
  private stats = { blocked: 0, allowed: 0 };
  private originalFetch: typeof fetch;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open;

  constructor() {
    this.originalFetch = window.fetch;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.init();
  }

  private init() {
    // Override fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      
      if (this.shouldBlock(url)) {
        this.stats.blocked++;
        console.log(`🚫 Blocked fetch request to: ${url}`);
        
        // Return mock response
        return new Response(
          JSON.stringify({ 
            blocked: true, 
            url, 
            timestamp: new Date().toISOString(),
            reason: 'Blocked by NetworkBlocker utility'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      this.stats.allowed++;
      return this.originalFetch(input, init);
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
      
      if (networkBlocker.shouldBlock(urlString)) {
        networkBlocker.stats.blocked++;
        console.log(`🚫 Blocked XMLHttpRequest to: ${urlString}`);
        
        // Mock the request
        setTimeout(() => {
          Object.defineProperty(this, 'readyState', { writable: true });
          Object.defineProperty(this, 'status', { writable: true });
          Object.defineProperty(this, 'responseText', { writable: true });
          
          this.readyState = 4;
          this.status = 200;
          this.responseText = JSON.stringify({ 
            blocked: true, 
            url: urlString,
            timestamp: new Date().toISOString(),
            reason: 'Blocked by NetworkBlocker utility'
          });
          
          if (this.onreadystatechange) {
            this.onreadystatechange.call(this, new Event('readystatechange'));
          }
        }, 0);
        return;
      }
      
      networkBlocker.stats.allowed++;
      return networkBlocker.originalXHROpen.call(this, method, url, async, user, password);
    };
  }

  private shouldBlock(url: string): boolean {
    if (this.isGloballyBlocked) return true;
    
    try {
      const urlObj = new URL(url, window.location.origin);
      return this.blockedDomains.has(urlObj.hostname);
    } catch {
      return false;
    }
  }

  public blockAll(): void {
    this.isGloballyBlocked = true;
    console.log('🚫 All network requests are now blocked');
  }

  public unblockAll(): void {
    this.isGloballyBlocked = false;
    this.blockedDomains.clear();
    console.log('✅ All network requests are now allowed');
  }

  public blockDomain(domain: string): void {
    this.blockedDomains.add(domain);
    console.log(`🚫 Blocked domain: ${domain}`);
  }

  public unblockDomain(domain: string): void {
    this.blockedDomains.delete(domain);
    console.log(`✅ Unblocked domain: ${domain}`);
  }

  public listBlocked(): string[] {
    const blocked = Array.from(this.blockedDomains);
    if (this.isGloballyBlocked) {
      blocked.push('*ALL*');
    }
    return blocked;
  }

  public getStats() {
    return { ...this.stats };
  }

  public reset(): void {
    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXHROpen;
    console.log('🔄 Network blocker has been reset');
  }
}

// Create global instance
const networkBlocker = new NetworkBlocker();

// Expose to global scope for devtools access
declare global {
  interface Window {
    networkBlocker: NetworkBlockerUtils;
  }
}

window.networkBlocker = {
  blockAll: () => networkBlocker.blockAll(),
  unblockAll: () => networkBlocker.unblockAll(),
  blockDomain: (domain: string) => networkBlocker.blockDomain(domain),
  unblockDomain: (domain: string) => networkBlocker.unblockDomain(domain),
  listBlocked: () => networkBlocker.listBlocked(),
  getStats: () => networkBlocker.getStats(),
};

export default networkBlocker;