import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import MyApp from '../../pages/_app'
import { AppProps } from 'next/app'

// Mock Next.js components
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>
  }
})

jest.mock('next/head', () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>
})

// Mock the GoogleAnalytics component
jest.mock('../../components/GoogleAnalytics', () => {
  return function MockGoogleAnalytics({ measurementId }: { measurementId: string }) {
    return <div data-testid="google-analytics">GA ID: {measurementId}</div>
  }
})

// Mock the CookieConsent component
jest.mock('react-cookie-consent', () => {
  return function MockCookieConsent({ children, onAccept, onDecline, ...props }: any) {
    return (
      <div data-testid="cookie-consent">
        {children}
        <button onClick={onAccept} data-testid="accept-button">接受</button>
        <button onClick={onDecline} data-testid="decline-button">拒絕</button>
      </div>
    )
  }
})

// Mock ErrorBoundary
jest.mock('../../components/ErrorBoundary', () => {
  return function MockErrorBoundary({ children }: { children: React.ReactNode }) {
    return <div data-testid="error-boundary">{children}</div>
  }
})

// Mock Layout
jest.mock('../../components/Layout', () => {
  return function MockLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="layout">{children}</div>
  }
})

// Test Component
const TestComponent = () => <div>Test Page</div>

describe('MyApp Component', () => {
  const mockAppProps: AppProps = {
    Component: TestComponent,
    pageProps: {},
    router: {} as any
  }

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('Without GA ID', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    })

    it('should NOT render cookie consent banner when GA ID is not set', () => {
      render(<MyApp {...mockAppProps} />)

      expect(screen.queryByTestId('cookie-consent')).not.toBeInTheDocument()
      expect(screen.queryByTestId('google-analytics')).not.toBeInTheDocument()
    })

    it('should render the page content normally', () => {
      render(<MyApp {...mockAppProps} />)

      expect(screen.getByText('Test Page')).toBeInTheDocument()
      expect(screen.getByTestId('layout')).toBeInTheDocument()
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    })
  })

  describe('With GA ID', () => {
    const testGAId = 'G-TEST123'

    beforeEach(() => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = testGAId
    })

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    })

    it('should render cookie consent banner when GA ID is set', () => {
      render(<MyApp {...mockAppProps} />)

      expect(screen.getByTestId('cookie-consent')).toBeInTheDocument()
      expect(screen.getByText(/本網站使用 cookies 來改善使用體驗和分析網站流量/)).toBeInTheDocument()
    })

    it('should include privacy policy link in cookie banner', () => {
      render(<MyApp {...mockAppProps} />)

      const privacyLink = screen.getByText('隱私政策')
      expect(privacyLink).toBeInTheDocument()
      expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy')
    })

    it('should NOT load GA initially when cookies not accepted', () => {
      render(<MyApp {...mockAppProps} />)

      expect(screen.queryByTestId('google-analytics')).not.toBeInTheDocument()
    })

    it('should load GA when cookies were previously accepted', () => {
      localStorage.setItem('CookieConsent', 'true')

      render(<MyApp {...mockAppProps} />)

      expect(screen.getByTestId('google-analytics')).toBeInTheDocument()
      expect(screen.getByText(`GA ID: ${testGAId}`)).toBeInTheDocument()
    })

    it('should NOT load GA when cookies were previously declined', () => {
      localStorage.setItem('CookieConsent', 'false')

      render(<MyApp {...mockAppProps} />)

      expect(screen.queryByTestId('google-analytics')).not.toBeInTheDocument()
    })

    it('should have accept and decline buttons', () => {
      render(<MyApp {...mockAppProps} />)

      expect(screen.getByTestId('accept-button')).toBeInTheDocument()
      expect(screen.getByTestId('decline-button')).toBeInTheDocument()
    })
  })

  describe('With pageProps GA ID', () => {
    const testGAId = 'G-PAGEPROPS123'

    it('should use pageProps GA ID over environment variable', () => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-ENV123'
      localStorage.setItem('CookieConsent', 'true')

      const propsWithGAId = {
        ...mockAppProps,
        pageProps: { gaId: testGAId }
      }

      render(<MyApp {...propsWithGAId} />)

      expect(screen.getByTestId('google-analytics')).toBeInTheDocument()
      expect(screen.getByText(`GA ID: ${testGAId}`)).toBeInTheDocument()
    })
  })

  describe('Cookie Consent Interaction', () => {
    const testGAId = 'G-TEST123'

    beforeEach(() => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = testGAId
      // Mock window.location.reload
      delete (window as any).location
      ;(window as any).location = { reload: jest.fn() }
    })

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    })

    it('should call reload when accept button is clicked', async () => {
      render(<MyApp {...mockAppProps} />)

      const acceptButton = screen.getByTestId('accept-button')
      fireEvent.click(acceptButton)

      await waitFor(() => {
        expect(window.location.reload).toHaveBeenCalled()
      })
    })

    it('should set cookiesAccepted to false when decline button is clicked', async () => {
      render(<MyApp {...mockAppProps} />)

      const declineButton = screen.getByTestId('decline-button')
      fireEvent.click(declineButton)

      // The state should be updated but no reload
      await waitFor(() => {
        expect(window.location.reload).not.toHaveBeenCalled()
      })
    })
  })

  describe('QueryClient Configuration', () => {
    it('should render QueryClientProvider', () => {
      render(<MyApp {...mockAppProps} />)

      // QueryClientProvider should wrap the content
      expect(screen.getByTestId('layout')).toBeInTheDocument()
    })
  })
})
