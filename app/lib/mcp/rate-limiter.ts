/**
 * MCP 專用 rate limiter
 *
 * RateLimiter 類別已抽出至 lib/rate-limiter.ts，這裡只負責 MCP 專屬的 globalRateLimiter instance
 * 與 re-export，維持既有 API 相容性。
 */
import { RateLimiter, getClientIdentifier } from '@/lib/rate-limiter';

// MCP endpoint 專用 instance
export const globalRateLimiter = new RateLimiter({
  maxRequests: parseInt(process.env.MCP_RATE_LIMIT_REQUESTS || '100'),
  windowMs: parseInt(process.env.MCP_RATE_LIMIT_WINDOW_MS || String(60 * 1000)),
  blockDurationMs: parseInt(process.env.MCP_RATE_LIMIT_BLOCK_MS || String(15 * 60 * 1000)),
});

// Re-export 維持既有 import 路徑可用
export { RateLimiter, getClientIdentifier };
export type { RateLimiterOptions, RateLimitResult } from '@/lib/rate-limiter';
