import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="min-h-screen bg-gray-200 font-sans">
      {/* Mobile Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Main Content */}
      <div className="flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 flex flex-col bg-gray-200">
          <main className="flex-1">
            <div className="container mx-auto px-6 py-8">{children}</div>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}