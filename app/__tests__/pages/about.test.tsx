import { render, screen } from '@testing-library/react'
import About from '../../pages/about'

// Mock the Layout component
jest.mock('../../components/Layout', () => {
  return function MockLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="layout">{children}</div>
  }
})

describe('About Page', () => {
  it('renders the about page correctly', () => {
    render(<About />)
    
    // Check main heading
    expect(screen.getByRole('heading', { level: 1, name: '關於本站' })).toBeInTheDocument()
    
    // Check main description
    expect(screen.getByText(/本站為IVOD搜尋網站/)).toBeInTheDocument()
    expect(screen.getByText(/會定期更新第11屆立法院之會議逐字記錄/)).toBeInTheDocument()
    
    // Check "關於我們" section
    expect(screen.getByRole('heading', { level: 2, name: '關於我們' })).toBeInTheDocument()
    
    // Check developers section
    expect(screen.getByRole('heading', { level: 3, name: '開發者' })).toBeInTheDocument()
    expect(screen.getByText('billy3321、Yutin')).toBeInTheDocument()
    
    // Check license section
    expect(screen.getByRole('heading', { level: 3, name: '授權條款' })).toBeInTheDocument()
    expect(screen.getByText(/本網站為g0v專案，以MIT License釋出/)).toBeInTheDocument()
    
    // Check GitHub link
    const githubLink = screen.getByRole('link', { name: /github.com\/billy3321\/ivod_transcript_db/ })
    expect(githubLink).toBeInTheDocument()
    expect(githubLink).toHaveAttribute('href', 'https://github.com/billy3321/ivod_transcript_db')
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
    
    // Check acknowledgments section
    expect(screen.getByRole('heading', { level: 3, name: '特別感謝' })).toBeInTheDocument()
    expect(screen.getByText('ronny wang')).toBeInTheDocument()
  })

  it('has proper styling classes applied', () => {
    render(<About />)
    
    // Check container structure
    const container = screen.getByTestId('layout')
    expect(container).toBeInTheDocument()
    
    // Check if GitHub link has proper styling
    const githubLink = screen.getByRole('link', { name: /github.com\/billy3321\/ivod_transcript_db/ })
    expect(githubLink).toHaveClass('text-blue-600', 'hover:text-blue-800', 'underline')
  })

  it('displays all required content sections', () => {
    render(<About />)
    
    const sections = [
      '關於本站',
      '關於我們', 
      '開發者',
      '授權條款',
      '特別感謝'
    ]
    
    sections.forEach(section => {
      expect(screen.getByText(section)).toBeInTheDocument()
    })
  })
})