import type { NextApiRequest, NextApiResponse } from 'next';
import { logger, LogLevel, LogEntry } from '@/lib/logger';
import { RateLimiter, getClientIdentifier } from '@/lib/rate-limiter';
import {
  withErrorHandler,
  validateMethod,
  createErrorResponse,
} from '@/lib/api-middleware';

interface LogRequest {
  level: LogLevel;
  message: string;
  context?: LogEntry['context'];
}

const MAX_MESSAGE_LENGTH = 4 * 1024; // 4KB
const MAX_CONTEXT_BYTES = 8 * 1024; // 8KB
const VALID_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug'];

// 獨立 rate limiter instance — 不與 MCP 共用配額
const logsRateLimiter = new RateLimiter({
  maxRequests: parseInt(process.env.LOGS_RATE_LIMIT_REQUESTS || '30', 10),
  windowMs: parseInt(process.env.LOGS_RATE_LIMIT_WINDOW_MS || String(60 * 1000), 10),
  blockDurationMs: parseInt(
    process.env.LOGS_RATE_LIMIT_BLOCK_MS || String(5 * 60 * 1000),
    10
  ),
});

function sanitizeMessage(input: unknown): string {
  if (typeof input !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const stripped = input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
  return stripped.slice(0, MAX_MESSAGE_LENGTH);
}

function sanitizeContext(input: any): LogEntry['context'] | undefined {
  if (!input || typeof input !== 'object') return undefined;
  try {
    const serialized = JSON.stringify(input);
    if (serialized.length > MAX_CONTEXT_BYTES) return undefined;
    return JSON.parse(serialized);
  } catch {
    return undefined;
  }
}

async function logsHandler(req: NextApiRequest, res: NextApiResponse) {
  validateMethod(req, ['POST']);

  // Rate limit
  const clientId = getClientIdentifier(req as any);
  const rateLimit = logsRateLimiter.checkLimit(clientId);
  res.setHeader('X-RateLimit-Limit', '30');
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetTime / 1000)));

  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateLimit.resetTime - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    // 直接回應 429 — middleware 不會覆蓋已 sent 的 response
    res.status(429).json({
      success: false,
      error: rateLimit.blocked ? 'Client temporarily blocked' : 'Rate limit exceeded',
      retryAfter,
    });
    return;
  }

  const body: Partial<LogRequest> = req.body || {};
  const level = body.level;
  const rawMessage = body.message;

  if (!level || !rawMessage) {
    throw createErrorResponse('Missing required fields: level and message', 400);
  }

  if (!VALID_LEVELS.includes(level)) {
    throw createErrorResponse('Invalid log level', 400);
  }

  const message = sanitizeMessage(rawMessage);
  if (!message) {
    throw createErrorResponse('Empty message after sanitization', 400);
  }

  const safeContext = sanitizeContext(body.context);

  const enrichedContext: LogEntry['context'] = {
    ...(safeContext || {}),
    ip: clientId,
    userAgent:
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    metadata: {
      ...(safeContext?.metadata || {}),
      timestamp: new Date().toISOString(),
    },
  };

  switch (level) {
    case 'error':
      logger.error(message, enrichedContext);
      break;
    case 'warn':
      logger.warn(message, enrichedContext);
      break;
    case 'info':
      logger.info(message, enrichedContext);
      break;
    case 'debug':
      logger.debug(message, enrichedContext);
      break;
  }

  res.status(200).json({ success: true });
}

export default withErrorHandler(logsHandler);

// 測試用 export，方便重置 rate limiter
export const __testing__ = { logsRateLimiter };
