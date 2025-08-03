// 在瀏覽器 Console 中執行此腳本來檢查 headers
// 複製以下代碼到瀏覽器開發者工具的 Console 分頁

async function checkCrossOriginHeaders() {
  console.log('🔍 檢查 Cross-Origin-Isolation Headers...');
  
  try {
    // 檢查當前頁面的響應 headers
    const response = await fetch(window.location.href, { 
      method: 'HEAD',
      cache: 'no-cache' 
    });
    
    console.log('📊 HTTP 響應 Headers:');
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('cross-origin')) {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    // 檢查瀏覽器環境
    console.log('🌐 瀏覽器環境狀態:');
    console.log(`  crossOriginIsolated: ${window.crossOriginIsolated}`);
    console.log(`  SharedArrayBuffer: ${typeof SharedArrayBuffer !== 'undefined'}`);
    console.log(`  WebAssembly: ${typeof WebAssembly !== 'undefined'}`);
    console.log(`  isSecureContext: ${window.isSecureContext}`);
    
    // 測試 SharedArrayBuffer
    try {
      const sab = new SharedArrayBuffer(1024);
      console.log('✅ SharedArrayBuffer 可用');
    } catch (e) {
      console.error('❌ SharedArrayBuffer 不可用:', e.message);
    }
    
    if (window.crossOriginIsolated) {
      console.log('🎉 Cross-Origin-Isolation 已啟用！FFmpeg 應該可以正常運作。');
    } else {
      console.warn('⚠️ Cross-Origin-Isolation 未啟用，FFmpeg 可能無法運作。');
      console.log('💡 請檢查以下項目:');
      console.log('  1. Cloudflare Transform Rules 是否已設定');
      console.log('  2. Headers 是否包含:');
      console.log('     - Cross-Origin-Embedder-Policy: credentialless');
      console.log('     - Cross-Origin-Opener-Policy: same-origin');
    }
    
  } catch (error) {
    console.error('❌ 檢查失敗:', error);
  }
}

// 執行檢查
checkCrossOriginHeaders();