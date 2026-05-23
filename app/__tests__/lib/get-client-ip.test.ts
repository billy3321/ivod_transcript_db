import {
  getClientIp,
  isTrustedProxy,
  _resetTrustedProxiesCache,
} from '@/lib/get-client-ip';

describe('get-client-ip', () => {
  beforeEach(() => {
    delete process.env.TRUSTED_PROXIES;
    _resetTrustedProxiesCache();
  });

  describe('with no TRUSTED_PROXIES configured', () => {
    it('returns socket IP, ignoring X-Forwarded-For', async () => {
      const req = {
        headers: { 'x-forwarded-for': '8.8.8.8' },
        socket: { remoteAddress: '10.0.0.1' },
      };
      expect(getClientIp(req)).toBe('10.0.0.1');
    });

    it('returns socket IP, ignoring X-Real-IP', () => {
      const req = {
        headers: { 'x-real-ip': '8.8.8.8' },
        socket: { remoteAddress: '10.0.0.1' },
      };
      expect(getClientIp(req)).toBe('10.0.0.1');
    });

    it('returns "unknown" when no socket info', () => {
      expect(getClientIp({ headers: {} })).toBe('unknown');
    });
  });

  describe('with TRUSTED_PROXIES configured', () => {
    beforeEach(() => {
      process.env.TRUSTED_PROXIES = '127.0.0.1,::1,10.0.0.0/8';
      _resetTrustedProxiesCache();
    });

    it('trusts X-Forwarded-For from 127.0.0.1', () => {
      const req = {
        headers: { 'x-forwarded-for': '8.8.8.8, 10.0.0.50' },
        socket: { remoteAddress: '127.0.0.1' },
      };
      expect(getClientIp(req)).toBe('8.8.8.8');
    });

    it('trusts X-Real-IP from ::1', () => {
      const req = {
        headers: { 'x-real-ip': '8.8.8.8' },
        socket: { remoteAddress: '::1' },
      };
      expect(getClientIp(req)).toBe('8.8.8.8');
    });

    it('trusts CIDR-matched proxy', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '10.0.0.42' },
      };
      expect(getClientIp(req)).toBe('1.2.3.4');
    });

    it('does NOT trust forwarded headers from untrusted IP', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '8.8.8.8' },
      };
      // 8.8.8.8 不在 trusted clear → 用 socket
      expect(getClientIp(req)).toBe('8.8.8.8');
    });

    it('handles IPv4-mapped IPv6 socket address', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '::ffff:127.0.0.1' },
      };
      expect(getClientIp(req)).toBe('1.2.3.4');
    });

    it('IPv4-mapped IPv6 socket matches CIDR trusted range', () => {
      // ::ffff:10.0.0.42 應該被 normalize 為 10.0.0.42 再對 10.0.0.0/8 CIDR 比對
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '::ffff:10.0.0.42' },
      };
      expect(getClientIp(req)).toBe('1.2.3.4');
    });

    it('takes first IP in X-Forwarded-For chain', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' },
        socket: { remoteAddress: '127.0.0.1' },
      };
      expect(getClientIp(req)).toBe('1.1.1.1');
    });

    it('falls back to socket when forwarded header empty', () => {
      const req = {
        headers: { 'x-forwarded-for': '' },
        socket: { remoteAddress: '127.0.0.1' },
      };
      expect(getClientIp(req)).toBe('127.0.0.1');
    });
  });

  describe('isTrustedProxy', () => {
    it('returns false when TRUSTED_PROXIES not set', () => {
      _resetTrustedProxiesCache();
      expect(isTrustedProxy('127.0.0.1')).toBe(false);
    });

    it('matches exact IP', () => {
      process.env.TRUSTED_PROXIES = '127.0.0.1';
      _resetTrustedProxiesCache();
      expect(isTrustedProxy('127.0.0.1')).toBe(true);
      expect(isTrustedProxy('127.0.0.2')).toBe(false);
    });

    it('matches CIDR', () => {
      process.env.TRUSTED_PROXIES = '192.168.1.0/24';
      _resetTrustedProxiesCache();
      expect(isTrustedProxy('192.168.1.50')).toBe(true);
      expect(isTrustedProxy('192.168.2.1')).toBe(false);
    });

    it('rejects malformed CIDR', () => {
      process.env.TRUSTED_PROXIES = '999.999.999.999/24';
      _resetTrustedProxiesCache();
      expect(isTrustedProxy('1.2.3.4')).toBe(false);
    });

    it('handles ::1 ↔ 127.0.0.1 cross-protocol matching', () => {
      process.env.TRUSTED_PROXIES = '127.0.0.1';
      _resetTrustedProxiesCache();
      expect(isTrustedProxy('::1')).toBe(true);
      process.env.TRUSTED_PROXIES = '::1';
      _resetTrustedProxiesCache();
      expect(isTrustedProxy('127.0.0.1')).toBe(true);
    });

    it('handles empty input', () => {
      process.env.TRUSTED_PROXIES = '127.0.0.1';
      _resetTrustedProxiesCache();
      expect(isTrustedProxy('')).toBe(false);
    });
  });
});
