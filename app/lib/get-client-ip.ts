/**
 * Client IP extraction with trusted proxy verification.
 *
 * 透過環境變數 TRUSTED_PROXIES（CSV）控制何時信任 forwarded headers。
 * 只有當「實際發起 TCP 連線的 IP」位於信任清單時，才信任
 * X-Forwarded-For / X-Real-IP；否則只用 socket IP 避免偽造。
 *
 * 支援 IPv4 / IPv6 / CIDR 區段。
 */

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  connection?: { remoteAddress?: string };
}

let cachedTrustedProxies: string[] | null = null;
let cachedTrustedSource: string | undefined = undefined;

function getTrustedProxies(): string[] {
  const env = process.env.TRUSTED_PROXIES;
  if (env === cachedTrustedSource && cachedTrustedProxies !== null) {
    return cachedTrustedProxies;
  }
  cachedTrustedSource = env;
  cachedTrustedProxies = !env
    ? []
    : env.split(',').map(s => s.trim()).filter(Boolean);
  return cachedTrustedProxies;
}

// 測試 hook：強制重新讀 env
export function _resetTrustedProxiesCache() {
  cachedTrustedProxies = null;
  cachedTrustedSource = undefined;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function ipv4Matches(ip: string, rule: string): boolean {
  if (!rule.includes('/')) {
    return ip === rule;
  }
  const [base, prefixStr] = rule.split('/');
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  if (prefix === 0) return true;
  const mask = (-1 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return '';
  // IPv4-mapped IPv6 (e.g. ::ffff:1.2.3.4) → 1.2.3.4
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip.trim();
}

export function isTrustedProxy(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  const rules = getTrustedProxies();
  for (const rule of rules) {
    if (rule === normalized) return true;
    // 處理 localhost / IPv6
    if ((rule === '127.0.0.1' || rule === '::1') && (normalized === '127.0.0.1' || normalized === '::1')) {
      return true;
    }
    // CIDR
    if (rule.includes('/') && ipv4Matches(normalized, rule)) {
      return true;
    }
  }
  return false;
}

/**
 * 提取真實 client IP。
 *
 * - 若請求來自信任的 proxy（socket IP 在 TRUSTED_PROXIES 中），讀 X-Forwarded-For（取最左）或 X-Real-IP
 * - 否則只用 socket IP，避免直連用戶偽造 forwarded headers
 */
export function getClientIp(req: RequestLike): string {
  const socketIp = normalizeIp(
    req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip
  );

  if (socketIp && isTrustedProxy(socketIp)) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) {
      const raw = Array.isArray(fwd) ? fwd[0] : fwd;
      const first = raw.split(',')[0].trim();
      if (first) return normalizeIp(first);
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp && !Array.isArray(realIp)) {
      return normalizeIp(realIp);
    }
  }

  // 不信任或無 forwarded → 用 socket
  return socketIp || 'unknown';
}

/**
 * For rate limiter — 識別符可以是 IP，但若你想加上 user-agent 或其它特徵作為更細的識別也可在此擴充
 */
export function getClientIdentifier(req: RequestLike): string {
  return getClientIp(req);
}
