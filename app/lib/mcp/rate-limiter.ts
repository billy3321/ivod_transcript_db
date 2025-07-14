import { logger } from '@/lib/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly blockDurationMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: {
    maxRequests?: number;
    windowMs?: number;
    blockDurationMs?: number;
  } = {}) {
    this.maxRequests = options.maxRequests || 100; // 每分鐘最多 100 次請求
    this.windowMs = options.windowMs || 60 * 1000; // 1 分鐘窗口
    this.blockDurationMs = options.blockDurationMs || 15 * 60 * 1000; // 封鎖 15 分鐘
    
    // 定期清理過期條目
    this.startCleanup();
  }

  /**
   * 檢查請求是否被速率限制
   * @param identifier 客戶端識別符（IP、用戶ID等）
   * @returns { allowed: boolean, remaining: number, resetTime: number }
   */
  checkLimit(identifier: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    blocked?: boolean;
  } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // 如果客戶端被封鎖，檢查是否可以解除封鎖
    if (entry?.blocked) {
      if (now >= entry.resetTime) {
        // 解除封鎖
        this.store.delete(identifier);
        logger.info('Rate limit block expired', { 
          component: 'RateLimiter',
          metadata: { identifier }
        });
      } else {
        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime,
          blocked: true
        };
      }
    }

    // 如果沒有記錄或已過期，創建新記錄
    if (!entry || now >= entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.windowMs,
        blocked: false
      };
      this.store.set(identifier, newEntry);
      
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: newEntry.resetTime
      };
    }

    // 增加請求計數
    entry.count++;

    // 檢查是否超過限制
    if (entry.count > this.maxRequests) {
      // 封鎖客戶端
      entry.blocked = true;
      entry.resetTime = now + this.blockDurationMs;
      
      logger.warn('Rate limit exceeded, blocking client', {
        component: 'RateLimiter',
        metadata: {
          identifier,
          count: entry.count,
          maxRequests: this.maxRequests,
          blockUntil: new Date(entry.resetTime).toISOString()
        }
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blocked: true
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * 重置特定客戶端的速率限制
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
    logger.info('Rate limit reset for client', { 
      component: 'RateLimiter',
      metadata: { identifier }
    });
  }

  /**
   * 獲取統計信息
   */
  getStats(): {
    totalClients: number;
    blockedClients: number;
    activeRequests: number;
  } {
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
      activeRequests
    };
  }

  /**
   * 啟動定期清理過期條目
   */
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
            remainingEntries: this.store.size 
          }
        });
      }
    }, this.windowMs);
  }

  /**
   * 停止清理定時器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 全域 rate limiter 實例
export const globalRateLimiter = new RateLimiter({
  maxRequests: parseInt(process.env.MCP_RATE_LIMIT_REQUESTS || '100'),
  windowMs: parseInt(process.env.MCP_RATE_LIMIT_WINDOW_MS || String(60 * 1000)),
  blockDurationMs: parseInt(process.env.MCP_RATE_LIMIT_BLOCK_MS || String(15 * 60 * 1000))
});

/**
 * 從請求中提取客戶端識別符
 */
export function getClientIdentifier(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  // 優先使用 X-Forwarded-For 標頭（用於代理後的真實 IP）
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ip.split(',')[0].trim();
  }

  // 使用 X-Real-IP 標頭
  const realIp = req.headers['x-real-ip'];
  if (realIp && !Array.isArray(realIp)) {
    return realIp;
  }

  // 最後使用連接 IP
  return req.ip || 'unknown';
}