import { isAllowedVideoOrigin } from '@/lib/video-allowlist';

describe('isAllowedVideoOrigin', () => {
  it('allows exact ly.gov.tw host', () => {
    expect(isAllowedVideoOrigin('https://ly.gov.tw/video.m3u8')).toBe(true);
  });

  it('allows ivod.ly.gov.tw', () => {
    expect(isAllowedVideoOrigin('https://ivod.ly.gov.tw/path/to.m3u8')).toBe(true);
  });

  it('allows lyvod.ly.gov.tw', () => {
    expect(isAllowedVideoOrigin('https://lyvod.ly.gov.tw/x.ts')).toBe(true);
  });

  it('allows subdomain of allowed host', () => {
    expect(isAllowedVideoOrigin('https://foo.ly.gov.tw/x.ts')).toBe(true);
  });

  it('allows hinet CDN', () => {
    expect(isAllowedVideoOrigin('https://ivod-lyvod.cdn.hinet.net/x.ts')).toBe(true);
  });

  it('rejects unrelated host', () => {
    expect(isAllowedVideoOrigin('https://evil.example.com/x.ts')).toBe(false);
  });

  it('rejects host with matching prefix but not suffix', () => {
    // ly.gov.tw.evil.com 不該被視為 ly.gov.tw subdomain
    expect(isAllowedVideoOrigin('https://ly.gov.tw.evil.com/x.ts')).toBe(false);
  });

  it('rejects host that simply contains allowed string', () => {
    expect(isAllowedVideoOrigin('https://notly.gov.tw/x.ts')).toBe(false);
  });

  it('rejects non-http(s) protocols', () => {
    expect(isAllowedVideoOrigin('javascript:alert(1)')).toBe(false);
    expect(isAllowedVideoOrigin('data:text/plain,foo')).toBe(false);
    expect(isAllowedVideoOrigin('file:///etc/passwd')).toBe(false);
    expect(isAllowedVideoOrigin('ftp://ly.gov.tw/x.ts')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isAllowedVideoOrigin('not a url')).toBe(false);
    expect(isAllowedVideoOrigin('')).toBe(false);
  });

  it('case insensitive host match', () => {
    expect(isAllowedVideoOrigin('https://IVOD.LY.GOV.TW/x.m3u8')).toBe(true);
  });
});
