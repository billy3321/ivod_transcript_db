import { render, screen, fireEvent } from '@testing-library/react'
import Privacy from '../../pages/privacy'

// Mock Next.js router
const mockBack = jest.fn()
jest.mock('next/router', () => ({
  useRouter: () => ({
    back: mockBack
  })
}))

// Mock Next.js components
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>
  }
})

jest.mock('next/head', () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>
})

describe('Privacy Page', () => {
  beforeEach(() => {
    mockBack.mockClear()
  })

  it('renders the privacy policy page correctly', () => {
    render(<Privacy />)

    expect(screen.getByRole('heading', { level: 1, name: '隱私政策' })).toBeInTheDocument()
  })

  it('displays all main sections', () => {
    render(<Privacy />)

    const sections = [
      /關於本隱私政策/,
      /我們收集哪些資料/,
      /如何使用這些資料/,
      /Cookies 的使用/,
      /第三方服務/,
      /資料安全/,
      /您的權利/,
      /兒童隱私/,
      /隱私政策變更/,
      /聯絡我們/
    ]

    sections.forEach(section => {
      expect(screen.getAllByText(section).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('displays information about data collection', () => {
    render(<Privacy />)

    expect(screen.getByText(/Google Analytics 自動收集以下資訊/i)).toBeInTheDocument()
    expect(screen.getAllByText('瀏覽器類型和版本').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('作業系統').length).toBeGreaterThanOrEqual(1)
  })

  it('displays information about data NOT collected', () => {
    render(<Privacy />)

    expect(screen.getByText(/本網站不要求使用者註冊或登入/i)).toBeInTheDocument()
    expect(screen.getByText('姓名、電子郵件或電話號碼')).toBeInTheDocument()
    expect(screen.getByText('帳號密碼')).toBeInTheDocument()
  })

  it('displays cookie information table', () => {
    render(<Privacy />)

    expect(screen.getByText('CookieConsent')).toBeInTheDocument()
    expect(screen.getByText('記錄您的 Cookie 同意選擇')).toBeInTheDocument()
    expect(screen.getByText('365 天')).toBeInTheDocument()
    expect(screen.getByText('_ga, _ga_*')).toBeInTheDocument()
    expect(screen.getByText('Google Analytics 分析用途')).toBeInTheDocument()
  })

  it('displays Google Analytics information', () => {
    render(<Privacy />)

    expect(screen.getByText(/本網站使用 Google Analytics 進行流量分析/i)).toBeInTheDocument()
  })

  it('has link to Google Privacy Policy', () => {
    render(<Privacy />)

    const googleLink = screen.getByRole('link', { name: /Google 隱私政策/ })
    expect(googleLink).toBeInTheDocument()
    expect(googleLink).toHaveAttribute('href', 'https://policies.google.com/privacy')
    expect(googleLink).toHaveAttribute('target', '_blank')
    expect(googleLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('has link to Google Analytics opt-out', () => {
    render(<Privacy />)

    const optOutLink = screen.getByRole('link', { name: /Google Analytics 退出擴充功能/ })
    expect(optOutLink).toBeInTheDocument()
    expect(optOutLink).toHaveAttribute('href', 'https://tools.google.com/dlpage/gaoptout')
    expect(optOutLink).toHaveAttribute('target', '_blank')
    expect(optOutLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('displays security measures', () => {
    render(<Privacy />)

    expect(screen.getByText('使用 HTTPS 加密傳輸')).toBeInTheDocument()
    expect(screen.getByText('IP 位址匿名化處理')).toBeInTheDocument()
    expect(screen.getByText('不儲存個人識別資訊')).toBeInTheDocument()
  })

  it('displays user rights', () => {
    render(<Privacy />)

    expect(screen.getByText(/拒絕權/i)).toBeInTheDocument()
    expect(screen.getByText(/刪除權/i)).toBeInTheDocument()
    expect(screen.getByText(/知情權/i)).toBeInTheDocument()
    expect(screen.getByText(/反對權/i)).toBeInTheDocument()
  })

  it('displays summary section', () => {
    render(<Privacy />)

    expect(screen.getByText('簡而言之')).toBeInTheDocument()
    expect(screen.getByText(/我們只使用 Google Analytics 進行匿名流量分析/)).toBeInTheDocument()
    expect(screen.getByText(/不收集任何個人識別資訊/)).toBeInTheDocument()
    expect(screen.getByText(/您可以隨時拒絕 Cookies/)).toBeInTheDocument()
  })

  it('has a back button that calls router.back()', () => {
    render(<Privacy />)

    const backButton = screen.getByRole('button', { name: /返回/ })
    expect(backButton).toBeInTheDocument()

    fireEvent.click(backButton)
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('has proper page title and meta description', () => {
    render(<Privacy />)

    expect(screen.getByText('隱私政策 - 立法院 IVOD 逐字稿檢索系統')).toBeInTheDocument()

    const metaDescription = document.querySelector('meta[name="description"]')
    expect(metaDescription).toBeInTheDocument()
  })

  it('displays contact information section', () => {
    render(<Privacy />)

    expect(screen.getByText(/如果您對本隱私政策有任何疑問或建議/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /提交問題/ })).toBeInTheDocument()
  })

  it('displays last updated date', () => {
    render(<Privacy />)

    // Should display current date in Chinese format
    const today = new Date().toLocaleDateString('zh-TW')
    expect(screen.getByText(new RegExp(today))).toBeInTheDocument()
  })

  it('has proper styling for main container', () => {
    const { container } = render(<Privacy />)

    const mainDiv = container.querySelector('.max-w-4xl')
    expect(mainDiv).toBeInTheDocument()
  })

  it('displays data usage purposes', () => {
    render(<Privacy />)

    expect(screen.getByText('分析網站流量和使用模式')).toBeInTheDocument()
    expect(screen.getByText('改善網站功能和使用者體驗')).toBeInTheDocument()
    expect(screen.getByText('了解哪些內容最受使用者歡迎')).toBeInTheDocument()
    expect(screen.getByText('診斷和修復技術問題')).toBeInTheDocument()
  })

  it('displays cookie management instructions', () => {
    render(<Privacy />)

    expect(screen.getByText(/您可以透過以下方式管理 Cookies/i)).toBeInTheDocument()
    expect(screen.getByText(/在首次訪問時選擇「拒絕」Cookie 橫幅/i)).toBeInTheDocument()
    const cookieClearTexts = screen.getAllByText(/清除瀏覽器中的 Cookies/i)
    expect(cookieClearTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('displays children privacy section', () => {
    render(<Privacy />)

    expect(screen.getByText(/本網站不針對 13 歲以下兒童/i)).toBeInTheDocument()
    expect(screen.getByText(/我們不會故意收集兒童的個人資料/i)).toBeInTheDocument()
  })

  it('displays policy update information', () => {
    render(<Privacy />)

    expect(screen.getByText(/我們可能會不時更新本隱私政策/i)).toBeInTheDocument()
    expect(screen.getByText(/建議您定期檢視本頁面/i)).toBeInTheDocument()
  })
})
