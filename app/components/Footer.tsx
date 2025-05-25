import { FC } from 'react';
import Link from 'next/link';

const Footer: FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Site Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">IVOD 搜尋網站</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              提供第11屆立法院會議逐字記錄搜尋服務
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">導覽</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-300 hover:text-white transition-colors duration-200">
                  首頁
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-300 hover:text-white transition-colors duration-200">
                  關於我們
                </Link>
              </li>
            </ul>
          </div>

          {/* External Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">相關連結</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://github.com/billy3321/ivod_transcript_db"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  原始碼
                </a>
              </li>
              <li>
                <a 
                  href="https://g0v.tw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  g0v 零時政府
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-700 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © {currentYear} IVOD 搜尋網站. 採用 MIT License 授權.
            </div>
            <div className="text-gray-400 text-sm">
              開發者: billy3321、Yutin
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;