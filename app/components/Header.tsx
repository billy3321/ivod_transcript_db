import { FC } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import NavText from './NavText'

interface HeaderProps {
  onMenuClick: () => void
}

const Header: FC<HeaderProps> = ({ onMenuClick }) => {
  const router = useRouter()
  
  const navItems = [
    { label: '首頁', href: '/' },
    { label: '關於我們', href: '/about' },
  ] as const
  
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b-4 border-indigo-600">
      {/* Logo and Brand */}
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="text-gray-500 focus:outline-none lg:hidden mr-4"
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 6H20M4 12H20M4 18H11"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        
        <Link href="/" className="flex items-center">
          <svg
            className="w-8 h-8"
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M364.61 390.213C304.625 450.196 207.37 450.196 147.386 390.213C117.394 360.22 102.398 320.911 102.398 281.6C102.398 242.291 117.394 202.981 147.386 172.989C147.386 230.4 153.6 281.6 230.4 307.2C230.4 256 256 102.4 294.4 76.7999C320 128 334.618 142.997 364.608 172.989C394.601 202.981 409.597 242.291 409.597 281.6C409.597 320.911 394.601 360.22 364.61 390.213Z"
              fill="#4C51BF"
              stroke="#4C51BF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M201.694 387.105C231.686 417.098 280.312 417.098 310.305 387.105C325.301 372.109 332.8 352.456 332.8 332.8C332.8 313.144 325.301 293.491 310.305 278.495C295.309 263.498 288 256 275.2 230.4C256 243.2 243.201 320 243.201 345.6C201.694 345.6 179.2 332.8 179.2 332.8C179.2 352.456 186.698 372.109 201.694 387.105Z"
              fill="white"
            />
          </svg>
          <span className="ml-2 text-xl font-semibold text-indigo-600">
            IVOD 逐字稿檢索系統
          </span>
        </Link>
      </div>
      
      {/* Navigation Menu */}
      <nav className="hidden lg:flex items-center space-x-6">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
              router.pathname === item.href
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
            }`}
            suppressHydrationWarning
          >
            <NavText text={item.label} />
          </Link>
        ))}
      </nav>
    </header>
  )
}

export default Header