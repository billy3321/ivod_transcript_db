import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MCPGuidePage from '../../pages/mcp-guide';
import { GetServerSidePropsContext } from 'next';

// Mock Layout component
jest.mock('../../components/Layout', () => {
  return function MockLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="layout">{children}</div>;
  };
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
});

describe('MCPGuidePage', () => {
  const defaultProps = {
    serverUrl: 'https://test-server.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders the main title and description', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      expect(screen.getByText('IVOD MCP 服務設定指南')).toBeInTheDocument();
      expect(screen.getByText('在 AI 助理中使用台灣立法院逐字稿搜尋服務')).toBeInTheDocument();
    });

    it('displays the correct MCP server URL', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      expect(screen.getByText('https://test-server.com/api/mcp')).toBeInTheDocument();
    });

    it('renders all client setup sections', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      expect(screen.getByText('Claude Desktop')).toBeInTheDocument();
      expect(screen.getByText('ChatGPT (GPTs)')).toBeInTheDocument();
      expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    });

    it('displays service features list', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      expect(screen.getAllByText(/search_transcripts/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/get_meeting_transcript/).length).toBeGreaterThan(0);
      expect(screen.getByText(/日誌記錄/)).toBeInTheDocument();
      expect(screen.getByText(/分頁查詢/)).toBeInTheDocument();
    });
  });

  describe('Configuration Text Generation', () => {
    it('generates correct Claude Desktop configuration', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      const codeBlocks = screen.getAllByText(/npx/);
      expect(codeBlocks.length).toBeGreaterThan(0);
      
      // Check for specific configuration elements
      expect(screen.getByText(/"ivod-transcript"/)).toBeInTheDocument();
      expect(screen.getByText(/"@modelcontextprotocol\/server-fetch"/)).toBeInTheDocument();
    });

    it('includes server URL in all configuration examples', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      const serverUrlElements = screen.getAllByText(/https:\/\/test-server\.com\/api\/mcp/);
      expect(serverUrlElements.length).toBeGreaterThan(2); // Should appear in multiple config examples
    });

    it('generates different config text for different clients', () => {
      const { container } = render(<MCPGuidePage {...defaultProps} />);
      
      // Claude config should contain "mcpServers"
      expect(container.textContent).toContain('mcpServers');
      
      // ChatGPT config should contain "schema_version"
      expect(container.textContent).toContain('schema_version');
      
      // Gemini config should contain "MCPClient"
      expect(container.textContent).toContain('MCPClient');
    });
  });

  describe('Copy Functionality', () => {
    it('shows copy buttons for all configuration sections', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      const copyButtons = screen.getAllByText(/複製/);
      expect(copyButtons.length).toBeGreaterThan(3); // Multiple copy buttons
    });

    it('handles copy button click and shows feedback', async () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      const copyButtons = screen.getAllByText('複製');
      const firstCopyButton = copyButtons[0];
      
      fireEvent.click(firstCopyButton);
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
      
      // Should show "已複製!" feedback
      expect(screen.getByText('已複製!')).toBeInTheDocument();
    });

    it('resets copy feedback after timeout', async () => {
      jest.useFakeTimers();
      
      render(<MCPGuidePage {...defaultProps} />);
      
      const copyButtons = screen.getAllByText('複製');
      fireEvent.click(copyButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('已複製!')).toBeInTheDocument();
      });
      
      // Fast forward time
      jest.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(screen.queryByText('已複製!')).not.toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });

    it('copies correct configuration text', async () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      const copyButtons = screen.getAllByText('複製');
      fireEvent.click(copyButtons[0]); // First should be Claude config
      
      await waitFor(() => {
        const writeTextCall = (navigator.clipboard.writeText as jest.Mock).mock.calls[0];
        expect(writeTextCall[0]).toContain('mcpServers');
        expect(writeTextCall[0]).toContain('https://test-server.com/api/mcp');
      });
    });
  });

  describe('Testing Section', () => {
    it('displays cURL testing example', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      expect(screen.getByText(/curl -X POST/)).toBeInTheDocument();
      expect(screen.getByText(/tools\/list/)).toBeInTheDocument();
    });

    it('shows MCP Inspector command', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      expect(screen.getByText(/npx @modelcontextprotocol\/inspector/)).toBeInTheDocument();
    });
  });

  describe('Documentation Sections', () => {
    it('displays MCP functions documentation', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      // Use getAllByText for elements that appear multiple times
      expect(screen.getAllByText('search_transcripts').length).toBeGreaterThan(0);
      expect(screen.getAllByText('get_meeting_transcript').length).toBeGreaterThan(0);
      
      // Check for parameter descriptions (may appear in multiple places)
      expect(screen.getAllByText(/query:/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/speakers:/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ivod_id:/).length).toBeGreaterThan(0);
    });

    it('shows best practices and limitations', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      expect(screen.getByText('注意事項與最佳實務')).toBeInTheDocument();
      expect(screen.getByText('效能建議')).toBeInTheDocument();
      expect(screen.getByText('限制說明')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('IVOD MCP 服務設定指南');
      
      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThan(3);
    });

    it('has accessible button text', () => {
      render(<MCPGuidePage {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.textContent).toMatch(/複製|已複製!/);
      });
    });
  });

  describe('Responsive Design Elements', () => {
    it('applies correct CSS classes for responsive layout', () => {
      const { container } = render(<MCPGuidePage {...defaultProps} />);
      
      // Check for responsive grid classes
      expect(container.querySelector('.grid')).toBeInTheDocument();
      expect(container.querySelector('.md\\:grid-cols-2')).toBeInTheDocument();
    });

    it('has proper spacing and padding classes', () => {
      const { container } = render(<MCPGuidePage {...defaultProps} />);
      
      expect(container.querySelector('.max-w-4xl')).toBeInTheDocument();
      expect(container.querySelector('.mx-auto')).toBeInTheDocument();
    });
  });
});

describe('getServerSideProps', () => {
  it('returns serverUrl from environment variable', async () => {
    const originalEnv = process.env.SERVER_URL;
    process.env.SERVER_URL = 'https://production-server.com';

    const mockContext = {} as GetServerSidePropsContext;
    
    // Import the function to test it
    const { getServerSideProps } = await import('../../pages/mcp-guide');
    const result = await getServerSideProps(mockContext);

    expect(result).toEqual({
      props: {
        serverUrl: 'https://production-server.com',
      },
    });

    process.env.SERVER_URL = originalEnv;
  });

  it('uses default serverUrl when environment variable not set', async () => {
    const originalEnv = process.env.SERVER_URL;
    delete process.env.SERVER_URL;

    const mockContext = {} as GetServerSidePropsContext;
    
    const { getServerSideProps } = await import('../../pages/mcp-guide');
    const result = await getServerSideProps(mockContext);

    expect(result).toEqual({
      props: {
        serverUrl: 'https://example.com',
      },
    });

    process.env.SERVER_URL = originalEnv;
  });

  it('includes GA ID when environment variable is set', async () => {
    const originalServerUrl = process.env.SERVER_URL;
    const originalGaId = process.env.GA_MEASUREMENT_ID;
    
    process.env.SERVER_URL = 'https://test-server.com';
    process.env.GA_MEASUREMENT_ID = 'G-TEST123456';

    const mockContext = {} as GetServerSidePropsContext;
    
    const { getServerSideProps } = await import('../../pages/mcp-guide');
    const result = await getServerSideProps(mockContext);

    expect(result).toEqual({
      props: {
        serverUrl: 'https://test-server.com',
        gaId: 'G-TEST123456',
      },
    });

    process.env.SERVER_URL = originalServerUrl;
    process.env.GA_MEASUREMENT_ID = originalGaId;
  });
});