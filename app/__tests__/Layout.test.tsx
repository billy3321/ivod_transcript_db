import { render, screen, fireEvent } from '@testing-library/react'
import Layout from '../components/Layout'

// Mock the child components
jest.mock('../components/Sidebar', () => {
  return function MockSidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) {
    return (
      <div data-testid="sidebar" data-open={isOpen}>
        <button onClick={() => setIsOpen(false)}>Close Sidebar</button>
        Sidebar Content
      </div>
    )
  }
})

jest.mock('../components/Header', () => {
  return function MockHeader({ onMenuClick }: { onMenuClick: () => void }) {
    return (
      <div data-testid="header">
        <button onClick={onMenuClick} data-testid="menu-button">Menu</button>
        Header Content
      </div>
    )
  }
})

jest.mock('../components/Footer', () => {
  return function MockFooter() {
    return <div data-testid="footer">Footer Content</div>
  }
})

describe('Layout Component', () => {
  const TestContent = () => <div>Test page content</div>

  it('renders all layout components correctly', () => {
    render(
      <Layout>
        <TestContent />
      </Layout>
    )

    // Check that all components are rendered
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
    expect(screen.getByText('Test page content')).toBeInTheDocument()
  })

  it('manages sidebar state correctly', () => {
    render(
      <Layout>
        <TestContent />
      </Layout>
    )

    const sidebar = screen.getByTestId('sidebar')
    const menuButton = screen.getByTestId('menu-button')
    const closeSidebarButton = screen.getByText('Close Sidebar')

    // Initially sidebar should be closed
    expect(sidebar).toHaveAttribute('data-open', 'false')

    // Open sidebar via menu button
    fireEvent.click(menuButton)
    expect(sidebar).toHaveAttribute('data-open', 'true')

    // Close sidebar via close button
    fireEvent.click(closeSidebarButton)
    expect(sidebar).toHaveAttribute('data-open', 'false')
  })

  it('has proper layout structure and styling', () => {
    render(
      <Layout>
        <TestContent />
      </Layout>
    )

    // Check main container classes
    const mainContainer = screen.getByTestId('sidebar').parentElement
    expect(mainContainer).toHaveClass('min-h-screen', 'bg-gray-200', 'font-sans')

    // Check that main content area is present
    const mainContent = screen.getByText('Test page content').closest('main')
    expect(mainContent).toBeInTheDocument()
    expect(mainContent).toHaveClass('flex-1')
  })

  it('renders children content in the main area', () => {
    const testContent = 'This is test content for the layout'
    render(
      <Layout>
        <div>{testContent}</div>
      </Layout>
    )

    expect(screen.getByText(testContent)).toBeInTheDocument()
    
    // Check that content is within the main container
    const content = screen.getByText(testContent)
    const mainContainer = content.closest('main')
    expect(mainContainer).toBeInTheDocument()
  })

  it('maintains proper flex layout with footer at bottom', () => {
    render(
      <Layout>
        <TestContent />
      </Layout>
    )

    const footer = screen.getByTestId('footer')
    const mainContent = screen.getByText('Test page content').closest('main')
    
    // Check that both main and footer are present
    expect(mainContent).toBeInTheDocument()
    expect(footer).toBeInTheDocument()
    
    // Check that they are in the correct flex container
    const flexContainer = footer.parentElement
    expect(flexContainer).toHaveClass('flex-1', 'flex', 'flex-col')
  })

  it('passes correct props to child components', () => {
    render(
      <Layout>
        <TestContent />
      </Layout>
    )

    // Verify sidebar receives isOpen and setIsOpen props by testing functionality
    const sidebar = screen.getByTestId('sidebar')
    const menuButton = screen.getByTestId('menu-button')
    
    expect(sidebar).toHaveAttribute('data-open', 'false')
    fireEvent.click(menuButton)
    expect(sidebar).toHaveAttribute('data-open', 'true')

    // Verify header receives onMenuClick prop by testing menu button functionality
    expect(menuButton).toBeInTheDocument()
  })
})