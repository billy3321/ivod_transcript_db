/**
 * In-memory rate limiter，跨 endpoint 共用。
 *
 * 各 endpoint 應建立自己的 instance 以擁有獨立配額（避免互相吃配額）。
 * MCP 的 instance 在 lib/mcp/rate-limiter.ts re-export。
 */
import { logger } from '@/lib/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

export interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blocked?: boolean;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly blockDurationMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.maxRequests = options.maxRequests || 100;
    this.windowMs = options.windowMs || 60 * 1000;
    this.blockDurationMs = options.blockDurationMs || 15 * 60 * 1000;

    this.startCleanup();
  }

  checkLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (entry?.blocked) {
      if (now >= entry.resetTime) {
        this.store.delete(identifier);
        logger.info('Rate limit block expired', {
          component: 'RateLimiter',
          metadata: { identifier },
        });
      } else {
        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime,
          blocked: true,
        };
      }
    }

    if (!entry || now >= entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.windowMs,
        blocked: false,
      };
      this.store.set(identifier, newEntry);

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    entry.count++;

    if (entry.count > this.maxRequests) {
      entry.blocked = true;
      entry.resetTime = now + this.blockDurationMs;

      logger.warn('Rate limit exceeded, blocking client', {
        component: 'RateLimiter',
        metadata: {
          identifier,
          count: entry.count,
          maxRequests: this.maxRequests,
          blockUntil: new Date(entry.resetTime).toISOString(),
        },
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blocked: true,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  reset(identifier: string): void {
    this.store.delete(identifier);
    logger.info('Rate limit reset for client', {
      component: 'RateLimiter',
      metadata: { identifier },
    });
  }

  getStats() {
    const now = Date.now();
    let blockedClients = 0;
    let activeRequests = 0;

    Array.from(this.store.values()).forEach(entry => {
      if (entry.blocked && now < entry.resetTime) {
        blockedClients++;
      } else if (!entry.blocked && now < entry.resetTime) {
        activeRequests += entry.count;
      }
    });

    return {
      totalClients: this.store.size,
      blockedClients,
      activeRequests,
    };
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const toDelete: string[] = [];

      for (const [identifier, entry] of this.store.entries()) {
        if (now >= entry.resetTime) {
          toDelete.push(identifier);
        }
      }

      for (const identifier of toDelete) {
        this.store.delete(identifier);
      }

      if (toDelete.length > 0) {
        logger.debug('Rate limiter cleanup', {
          component: 'RateLimiter',
          metadata: {
            cleanedEntries: toDelete.length,
            remainingEntries: this.store.size,
          },
        });
      }
    }, this.windowMs);

    // 讓 Node.js 不會因為這個 timer 而 hold process（測試環境很重要）
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  clear(): void {
    this.store.clear();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// re-export 共用的 client IP 偵測（含 trusted proxy 驗證）
export { getClientIdentifier } from '@/lib/get-client-ip';
