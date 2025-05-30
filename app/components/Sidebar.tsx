import { FC } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import NavText from './NavText'

interface SidebarProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const Sidebar: FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const router = useRouter()
  const activeClass =
    'bg-gray-600 bg-opacity-25 text-gray-100 border-gray-100'
  const inactiveClass =
    'border-gray-900 text-gray-500 hover:bg-gray-600 hover:bg-opacity-25 hover:text-gray-100'

  const navItems = [
    { label: '首頁', href: '/' },
    { label: '關於我們', href: '/about' },
  ] as const

  return (
    <div className="flex">
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-20 bg-black opacity-50 lg:hidden"
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 overflow-y-auto bg-gray-900 transform transition duration-300 lg:hidden ${
          isOpen ? 'translate-x-0 ease-out' : '-translate-x-full ease-in'
        }`}
      >
        <div className="flex items-center justify-center mt-8">
          <div className="flex items-center">
            <svg
              className="w-12 h-12"
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
            <span className="mx-2 text-2xl font-semibold text-white">
              IVOD
            </span>
          </div>
        </div>
        <nav className="mt-10" data-cy="sidebar">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={`flex items-center px-6 py-2 mt-4 duration-200 border-l-4 ${
                  router.pathname === item.href ? activeClass : inactiveClass
                }`}>
              <span className="mx-4"><NavText text={item.label} /></span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default Sidebar