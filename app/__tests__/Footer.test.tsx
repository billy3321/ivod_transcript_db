import { render, screen, waitFor, act } from '@testing-library/react'
import Footer, { resetDatabaseStatusCache } from '../components/Footer'

// Mock fetch
global.fetch = jest.fn();

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => {
    return <a href={href} className={className}>{children}</a>
  }
})

describe('Footer Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    // Reset cache before each test
    resetDatabaseStatusCache();
    // Default mock for database status API
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
    });
  })

  it('renders the main footer sections', () => {
    render(<Footer />);
    
    // Check main headings
    expect(screen.getByText('IVOD 逐字稿檢索系統')).toBeInTheDocument()
    expect(screen.getByText('導覽')).toBeInTheDocument()
    expect(screen.getByText('相關連結')).toBeInTheDocument()
    
    // Check site description
    expect(screen.getByText('提供第11屆立法院會議逐字記錄搜尋服務')).toBeInTheDocument()
  })

  it('renders navigation links correctly', () => {
    render(<Footer />);
    
    // Check internal navigation links
    const homeLink = screen.getByRole('link', { name: '首頁' })
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute('href', '/')
    
    const aboutLink = screen.getByRole('link', { name: '關於我們' })
    expect(aboutLink).toBeInTheDocument()
    expect(aboutLink).toHaveAttribute('href', '/about')
  })

  it('renders external links with proper attributes', () => {
    render(<Footer />);
    
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
    render(<Footer />);
    
    const currentYear = new Date().getFullYear()
    const copyrightText = screen.getByText(`© ${currentYear} IVOD 逐字稿檢索系統。本網站採用 MIT License 授權。`)
    expect(copyrightText).toBeInTheDocument()
  })

  it('displays developer information', () => {
    render(<Footer />);
    
    expect(screen.getByText('開發者: billy3321、Yutin')).toBeInTheDocument()
  })

  it('has proper styling classes for responsive design', () => {
    render(<Footer />);
    
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveClass('bg-gray-800', 'text-white', 'py-8', 'mt-auto')
    
    // Check if grid layout classes are present
    const gridContainer = footer.querySelector('.grid')
    expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-3', 'gap-8')
  })

  it('uses cached database status on subsequent renders', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ lastUpdated: '2023-12-25 15:30:45+08:00' })
    });

    // 第一次渲染
    const { unmount } = render(<Footer />);
    await waitFor(() => {
      expect(screen.getByText(/本資料庫最後更新時間為：/)).toBeInTheDocument()
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    
    unmount();
    
    // 第二次渲染 - 應該使用快取，不再呼叫 API
    render(<Footer />);
    await waitFor(() => {
      expect(screen.getByText(/本資料庫最後更新時間為：/)).toBeInTheDocument()
    });
    
    // API 只應該被呼叫一次（第一次渲染時）
    expect(fetch).toHaveBeenCalledTimes(1);
  })

  it('applies hover effects to links', () => {
    render(<Footer />);
    
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
    render(<Footer />);
    
    // Check that it uses semantic footer element
    const footer = screen.getByRole('contentinfo')
    expect(footer.tagName).toBe('FOOTER')
    
    // Check heading hierarchy
    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings).toHaveLength(3)
    expect(headings[0]).toHaveTextContent('IVOD 逐字稿檢索系統')
    expect(headings[1]).toHaveTextContent('導覽')
    expect(headings[2]).toHaveTextContent('相關連結')
  })

  it('fetches and displays database last updated time only once', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ lastUpdated: '2023-12-25 15:30:45+08:00' })
    });

    // 第一次渲染 Footer
    await act(async () => {
      render(<Footer />);
    });

    await waitFor(() => {
      expect(screen.getByText(/本資料庫最後更新時間為：/)).toBeInTheDocument()
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/database-status');
  })

  it('does not display database time when API fails', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    await act(async () => {
      render(<Footer />);
    });

    // Wait a bit to ensure the fetch completes
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(screen.queryByText(/本資料庫最後更新時間為：/)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  })
})