import { render, screen } from '@testing-library/react'
import Footer from '../components/Footer'

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>
  }
})

describe('Footer Component', () => {
  beforeEach(() => {
    render(<Footer />)
  })

  it('renders the main footer sections', () => {
    // Check main headings
    expect(screen.getByText('IVOD 搜尋網站')).toBeInTheDocument()
    expect(screen.getByText('導覽')).toBeInTheDocument()
    expect(screen.getByText('相關連結')).toBeInTheDocument()
    
    // Check site description
    expect(screen.getByText('提供第11屆立法院會議逐字記錄搜尋服務')).toBeInTheDocument()
  })

  it('renders navigation links correctly', () => {
    // Check internal navigation links
    const homeLink = screen.getByRole('link', { name: '首頁' })
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute('href', '/')
    
    const aboutLink = screen.getByRole('link', { name: '關於我們' })
    expect(aboutLink).toBeInTheDocument()
    expect(aboutLink).toHaveAttribute('href', '/about')
  })

  it('renders external links with proper attributes', () => {
    // Check GitHub link
    const githubLink = screen.getByRole('link', { name: '原始碼' })
    expect(githubLink).toBeInTheDocument()
    expect(githubLink).toHaveAttribute('href', 'https://github.com/billy3321/ivod_transcript_db')
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
    
    // Check g0v link
    const g0vLink = screen.getByRole('link', { name: 'g0v 零時政府' })
    expect(g0vLink).toBeInTheDocument()
    expect(g0vLink).toHaveAttribute('href', 'https://g0v.tw')
    expect(g0vLink).toHaveAttribute('target', '_blank')
    expect(g0vLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('displays copyright information with current year', () => {
    const currentYear = new Date().getFullYear()
    const copyrightText = screen.getByText(`© ${currentYear} IVOD 搜尋網站. 採用 MIT License 授權.`)
    expect(copyrightText).toBeInTheDocument()
  })

  it('displays developer information', () => {
    expect(screen.getByText('開發者: billy3321、Yutin')).toBeInTheDocument()
  })

  it('has proper styling classes for responsive design', () => {
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveClass('bg-gray-800', 'text-white', 'py-8', 'mt-auto')
    
    // Check if grid layout classes are present
    const gridContainer = footer.querySelector('.grid')
    expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-3', 'gap-8')
  })

  it('applies hover effects to links', () => {
    const homeLink = screen.getByRole('link', { name: '首頁' })
    expect(homeLink).toHaveClass('text-gray-300')
    expect(homeLink).toHaveClass('hover:text-white')
    expect(homeLink).toHaveClass('transition-colors')
    
    const githubLink = screen.getByRole('link', { name: '原始碼' })
    expect(githubLink).toHaveClass('text-gray-300')
    expect(githubLink).toHaveClass('hover:text-white')
    expect(githubLink).toHaveClass('transition-colors')
  })

  it('has proper semantic structure', () => {
    // Check that it uses semantic footer element
    const footer = screen.getByRole('contentinfo')
    expect(footer.tagName).toBe('FOOTER')
    
    // Check heading hierarchy
    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings).toHaveLength(3)
    expect(headings[0]).toHaveTextContent('IVOD 搜尋網站')
    expect(headings[1]).toHaveTextContent('導覽')
    expect(headings[2]).toHaveTextContent('相關連結')
  })
})