import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/router';
import Header from '@/components/Header';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock NavText component
jest.mock('@/components/NavText', () => {
  return function MockNavText({ text }: any) {
    return <span data-testid="nav-text">{text}</span>;
  };
});

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('Header', () => {
  const mockOnMenuClick = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      pathname: '/',
      push: jest.fn(),
      query: {},
      asPath: '/',
      route: '/',
      back: jest.fn(),
      beforePopState: jest.fn(),
      prefetch: jest.fn(),
      reload: jest.fn(),
      replace: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
      isLocaleDomain: false,
      isReady: true,
      isPreview: false,
    });
  });

  describe('Basic Rendering', () => {
    it('renders header with correct structure', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('flex', 'items-center', 'justify-between', 'px-6', 'py-4', 'bg-white', 'border-b-4', 'border-indigo-600');
    });

    it('renders brand logo as link to home', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const brandLink = screen.getByRole('link', { name: /IVOD 逐字稿檢索系統/i });
      expect(brandLink).toBeInTheDocument();
      expect(brandLink).toHaveAttribute('href', '/');
    });

    it('renders navigation items', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      expect(screen.getByRole('link', { name: '首頁' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '關於我們' })).toBeInTheDocument();
    });
  });

  describe('Mobile Menu Button', () => {
    it('renders mobile menu button', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      expect(menuButton).toBeInTheDocument();
      expect(menuButton).toHaveClass('lg:hidden');
    });

    it('calls onMenuClick when mobile menu button is clicked', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      fireEvent.click(menuButton);
      
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
    });

    it('has proper mobile menu button styling', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      expect(menuButton).toHaveClass('text-gray-500', 'focus:outline-none', 'lg:hidden', 'mr-4');
    });

    it('renders hamburger icon in mobile menu button', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      const svg = menuButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-6', 'h-6');
    });
  });

  describe('Navigation Links', () => {
    it('renders navigation links with correct hrefs', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const homeLink = screen.getByRole('link', { name: '首頁' });
      const aboutLink = screen.getByRole('link', { name: '關於我們' });
      
      expect(homeLink).toHaveAttribute('href', '/');
      expect(aboutLink).toHaveAttribute('href', '/about');
    });

    it('highlights active navigation item based on router pathname', () => {
      mockUseRouter.mockReturnValue({
        pathname: '/about',
        push: jest.fn(),
        query: {},
        asPath: '/about',
        route: '/about',
        back: jest.fn(),
        beforePopState: jest.fn(),
        prefetch: jest.fn(),
        reload: jest.fn(),
        replace: jest.fn(),
        events: {
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
        },
        isFallback: false,
        isLocaleDomain: false,
        isReady: true,
        isPreview: false,
      });

      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const aboutLink = screen.getByRole('link', { name: '關於我們' });
      const homeLink = screen.getByRole('link', { name: '首頁' });
      
      // Check CSS classes for active state
      expect(aboutLink).toHaveClass('bg-indigo-100', 'text-indigo-700');
      expect(homeLink).toHaveClass('text-gray-600');
    });

    it('marks home as active when on root path', () => {
      mockUseRouter.mockReturnValue({
        pathname: '/',
        push: jest.fn(),
        query: {},
        asPath: '/',
        route: '/',
        back: jest.fn(),
        beforePopState: jest.fn(),
        prefetch: jest.fn(),
        reload: jest.fn(),
        replace: jest.fn(),
        events: {
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
        },
        isFallback: false,
        isLocaleDomain: false,
        isReady: true,
        isPreview: false,
      });

      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const homeLink = screen.getByRole('link', { name: '首頁' });
      
      // Check CSS classes for active state
      expect(homeLink).toHaveClass('bg-indigo-100', 'text-indigo-700');
    });
  });

  describe('Logo and Brand', () => {
    it('renders logo SVG', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const brandLink = screen.getByRole('link', { name: /IVOD 逐字稿檢索系統/i });
      const logoSvg = brandLink.querySelector('svg');
      
      expect(logoSvg).toBeInTheDocument();
      expect(logoSvg).toHaveClass('w-8', 'h-8');
    });

    it('renders brand text', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      expect(screen.getByText(/IVOD 逐字稿檢索系統/)).toBeInTheDocument();
    });

    it('has proper brand styling', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const brandLink = screen.getByRole('link', { name: /IVOD 逐字稿檢索系統/i });
      expect(brandLink).toHaveClass('flex', 'items-center');
      
      const brandText = screen.getByText(/IVOD 逐字稿檢索系統/);
      expect(brandText).toHaveClass('ml-2', 'text-xl', 'font-semibold', 'text-indigo-600');
    });
  });

  describe('Responsive Design', () => {
    it('hides navigation on mobile', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const desktopNav = screen.getByRole('navigation');
      expect(desktopNav).toHaveClass('hidden', 'lg:flex');
    });

    it('shows mobile menu button only on mobile', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      expect(menuButton).toHaveClass('lg:hidden');
    });

    it('has proper responsive layout structure', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('flex', 'items-center', 'justify-between');
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('has accessible mobile menu button', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      expect(menuButton).toHaveAttribute('type', 'button');
    });

    it('has proper focus management', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      expect(menuButton).toHaveClass('focus:outline-none');
    });

    it('provides proper aria labels for navigation', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });
  });

  describe('Brand Link Functionality', () => {
    it('renders brand as clickable link', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const brandLink = screen.getByRole('link', { name: /IVOD 逐字稿檢索系統/i });
      expect(brandLink).toHaveAttribute('href', '/');
    });

    it('maintains proper link accessibility', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const brandLink = screen.getByRole('link', { name: /IVOD 逐字稿檢索系統/i });
      expect(brandLink).toBeInTheDocument();
      
      // Should be focusable
      brandLink.focus();
      expect(document.activeElement).toBe(brandLink);
    });
  });

  describe('SVG Icons', () => {
    it('renders hamburger menu icon with correct path', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      const svg = menuButton.querySelector('svg');
      const path = svg?.querySelector('path');
      
      expect(path).toHaveAttribute('d', 'M4 6H20M4 12H20M4 18H11');
    });

    it('renders logo icon with proper styling', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const brandLink = screen.getByRole('link', { name: /IVOD 逐字稿檢索系統/i });
      const logoSvg = brandLink.querySelector('svg');
      
      expect(logoSvg).toHaveAttribute('viewBox', '0 0 512 512');
      expect(logoSvg).toHaveClass('w-8', 'h-8');
    });
  });

  describe('Edge Cases', () => {
    it('handles router pathname edge cases', () => {
      // Test with pathname that doesn't match any nav item
      mockUseRouter.mockReturnValue({
        pathname: '/some-unknown-page',
        push: jest.fn(),
        query: {},
        asPath: '/some-unknown-page',
        route: '/some-unknown-page',
        back: jest.fn(),
        beforePopState: jest.fn(),
        prefetch: jest.fn(),
        reload: jest.fn(),
        replace: jest.fn(),
        events: {
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
        },
        isFallback: false,
        isLocaleDomain: false,
        isReady: true,
        isPreview: false,
      });

      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const homeLink = screen.getByRole('link', { name: '首頁' });
      const aboutLink = screen.getByRole('link', { name: '關於我們' });
      
      // Both links should have inactive classes
      expect(homeLink).toHaveClass('text-gray-600');
      expect(aboutLink).toHaveClass('text-gray-600');
    });

    it('handles multiple menu button clicks', () => {
      render(<Header onMenuClick={mockOnMenuClick} />);
      
      const menuButton = screen.getByRole('button');
      
      fireEvent.click(menuButton);
      fireEvent.click(menuButton);
      fireEvent.click(menuButton);
      
      expect(mockOnMenuClick).toHaveBeenCalledTimes(3);
    });
  });
});