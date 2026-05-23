/**
 * 影片來源網域 allowlist
 *
 * VideoDownloader 會遞迴 fetch m3u8 與 ts 片段。
 * 為了避免 DB 內容被竄改後讓瀏覽器 fetch 任意網址，
 * 對每個下載 URL 做 origin 驗證。
 */

export const ALLOWED_VIDEO_HOSTS = [
  'ly.gov.tw',
  'ivod.ly.gov.tw',
  'lyvod.ly.gov.tw',
  'cdn.hinet.net',
  'ivod-lyvod.cdn.hinet.net',
];

/**
 * 判斷 URL 是否在允許清單。
 * 接受 host 完全相符，或 host 為 allowed entry 的 subdomain。
 */
export function isAllowedVideoOrigin(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_VIDEO_HOSTS.some(allowed => {
      const a = allowed.toLowerCase();
      return host === a || host.endsWith('.' + a);
    });
  } catch {
    return false;
  }
}
