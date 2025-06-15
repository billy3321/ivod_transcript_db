import React from 'react';
import { render, screen } from '@testing-library/react';
import SearchResults from '@/components/SearchResults';
import { IVOD } from '@/types';

// Mock the List component since it's tested separately
jest.mock('@/components/List', () => {
  return function MockList({ ivods, transcriptSearchResults }: any) {
    return (
      <div data-testid="mock-list">
        <div>Items count: {ivods?.length || 0}</div>
        <div>Transcript results: {transcriptSearchResults?.length || 0}</div>
      </div>
    );
  };
});

describe('SearchResults', () => {
  const mockIVODs: IVOD[] = [
    {
      id: 1,
      title: 'Test IVOD 1',
      meeting_name: 'Test Meeting',
      speaker_name: '王委員',
      committee_names: ['財政委員會'],
      video_type: 'speech',
      video_time: '10:30:45',
      ai_transcript: 'Test transcript content',
      ly_transcript: '',
      video_length: '00:15:30',
      meet_date: new Date('2024-01-01'),
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      title: 'Test IVOD 2',
      meeting_name: 'Another Meeting',
      speaker_name: '李委員',
      committee_names: ['教育委員會'],
      video_type: 'speech',
      video_time: '14:20:10',
      ai_transcript: 'Another transcript',
      ly_transcript: '',
      video_length: '00:12:45',
      meet_date: new Date('2024-01-02'),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const defaultProps = {
    data: {
      data: mockIVODs,
      meta: { total: 2, page: 1, pageSize: 10 }
    },
    loading: false,
    searchScope: 'all' as const,
    searchQuery: '',
    transcriptSearchResults: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading indicator when loading is true', () => {
      render(<SearchResults {...defaultProps} loading={true} />);
      
      expect(screen.getByText('搜尋中...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not show loading indicator when loading is false', () => {
      render(<SearchResults {...defaultProps} loading={false} />);
      
      expect(screen.queryByText('搜尋中...')).not.toBeInTheDocument();
    });
  });

  describe('Results Count Display', () => {
    it('displays correct total count', () => {
      render(<SearchResults {...defaultProps} />);
      
      expect(screen.getByText(/找到.*2.*筆 IVOD 紀錄/)).toBeInTheDocument();
    });

    it('displays zero count when no data', () => {
      render(<SearchResults 
        {...defaultProps} 
        data={{ data: [], meta: { total: 0, page: 1, pageSize: 10 } }}
      />);
      
      expect(screen.getByText(/找到.*0.*筆 IVOD 紀錄/)).toBeInTheDocument();
    });

    it('handles null data gracefully', () => {
      render(<SearchResults {...defaultProps} data={null} />);
      
      expect(screen.queryByText(/找到.*筆 IVOD 紀錄/)).not.toBeInTheDocument();
    });
  });

  describe('Search Scope Indicators', () => {
    it('shows "全部欄位" indicator when searchScope is "all" and has query', () => {
      render(<SearchResults 
        {...defaultProps} 
        searchScope="all" 
        searchQuery="test query"
      />);
      
      expect(screen.getByText('・搜尋範圍：全部欄位')).toBeInTheDocument();
    });

    it('shows "僅逐字稿" indicator when searchScope is "transcript" and has query', () => {
      render(<SearchResults 
        {...defaultProps} 
        searchScope="transcript" 
        searchQuery="test query"
      />);
      
      expect(screen.getByText('・搜尋範圍：僅逐字稿')).toBeInTheDocument();
    });

    it('does not show scope indicator when searchQuery is empty', () => {
      render(<SearchResults 
        {...defaultProps} 
        searchScope="all" 
        searchQuery=""
      />);
      
      expect(screen.queryByText('・搜尋範圍：全部欄位')).not.toBeInTheDocument();
    });
  });

  describe('Transcript Search Results', () => {
    const transcriptResults = [
      { id: 1, transcript: 'Matching transcript 1' },
      { id: 2, transcript: 'Matching transcript 2' },
    ];

    it('shows transcript match count when searchScope is transcript', () => {
      render(<SearchResults 
        {...defaultProps} 
        searchScope="transcript"
        transcriptSearchResults={transcriptResults}
      />);
      
      expect(screen.getByText('・2 筆逐字稿符合關鍵字')).toBeInTheDocument();
    });

    it('does not show transcript count when searchScope is all', () => {
      render(<SearchResults 
        {...defaultProps} 
        searchScope="all"
        transcriptSearchResults={transcriptResults}
      />);
      
      expect(screen.queryByText('・2 筆逐字稿符合關鍵字')).not.toBeInTheDocument();
    });

    it('does not show transcript count when no transcript results', () => {
      render(<SearchResults 
        {...defaultProps} 
        searchScope="transcript"
        transcriptSearchResults={[]}
      />);
      
      expect(screen.queryByText(/筆逐字稿符合關鍵字/)).not.toBeInTheDocument();
    });
  });

  describe('No Results State', () => {
    it('shows no results message when data is empty array', () => {
      render(<SearchResults 
        {...defaultProps} 
        data={{ data: [], meta: { total: 0, page: 1, pageSize: 10 } }}
      />);
      
      expect(screen.getByText('沒有找到相關的 IVOD 紀錄')).toBeInTheDocument();
      expect(screen.getByText('請嘗試：')).toBeInTheDocument();
      expect(screen.getByText('• 使用更簡單的關鍵字')).toBeInTheDocument();
      expect(screen.getByText('• 檢查拼字是否正確')).toBeInTheDocument();
      expect(screen.getByText('• 嘗試不同的搜尋條件')).toBeInTheDocument();
    });

    it('does not show no results message when data is null', () => {
      render(<SearchResults {...defaultProps} data={null} />);
      
      expect(screen.queryByText('沒有找到相關的 IVOD 紀錄')).not.toBeInTheDocument();
    });

    it('does not show no results message when has data', () => {
      render(<SearchResults {...defaultProps} />);
      
      expect(screen.queryByText('沒有找到相關的 IVOD 紀錄')).not.toBeInTheDocument();
    });
  });

  describe('List Component Integration', () => {
    it('passes correct props to List component when has data', () => {
      render(<SearchResults {...defaultProps} />);
      
      expect(screen.getByTestId('mock-list')).toBeInTheDocument();
      expect(screen.getByText('Items count: 2')).toBeInTheDocument();
      expect(screen.getByText('Transcript results: 0')).toBeInTheDocument();
    });

    it('passes transcript search results to List component', () => {
      const transcriptResults = [
        { id: 1, transcript: 'Match 1' },
        { id: 2, transcript: 'Match 2' },
      ];
      
      render(<SearchResults 
        {...defaultProps} 
        transcriptSearchResults={transcriptResults}
      />);
      
      expect(screen.getByText('Transcript results: 2')).toBeInTheDocument();
    });

    it('does not render List component when no data', () => {
      render(<SearchResults 
        {...defaultProps} 
        data={{ data: [], meta: { total: 0, page: 1, pageSize: 10 } }}
      />);
      
      expect(screen.queryByTestId('mock-list')).not.toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    it('shows loading spinner with correct styling', () => {
      render(<SearchResults {...defaultProps} loading={true} />);
      
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('animate-spin', 'rounded-full', 'h-4', 'w-4', 'border-b-2', 'border-blue-600');
    });

    it('has proper semantic structure', () => {
      render(<SearchResults {...defaultProps} />);
      
      // Results count should be in a paragraph
      expect(screen.getByText(/找到.*2.*筆 IVOD 紀錄/).tagName).toBe('P');
      
      // Loading indicator should have status role
      render(<SearchResults {...defaultProps} loading={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined meta data', () => {
      render(<SearchResults 
        {...defaultProps} 
        data={{ data: mockIVODs, meta: undefined as any }}
      />);
      
      expect(screen.getByText(/找到.*0.*筆 IVOD 紀錄/)).toBeInTheDocument();
    });

    it('handles meta data without total', () => {
      render(<SearchResults 
        {...defaultProps} 
        data={{ data: mockIVODs, meta: { page: 1, pageSize: 10 } as any }}
      />);
      
      expect(screen.getByText(/找到.*0.*筆 IVOD 紀錄/)).toBeInTheDocument();
    });

    it('handles long search query in scope indicator', () => {
      const longQuery = 'a'.repeat(100);
      render(<SearchResults 
        {...defaultProps} 
        searchScope="all" 
        searchQuery={longQuery}
      />);
      
      expect(screen.getByText('・搜尋範圍：全部欄位')).toBeInTheDocument();
    });

    it('handles large transcript search results count', () => {
      const manyResults = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        transcript: `Result ${i}`
      }));
      
      render(<SearchResults 
        {...defaultProps} 
        searchScope="transcript"
        transcriptSearchResults={manyResults}
      />);
      
      expect(screen.getByText('・1000 筆逐字稿符合關鍵字')).toBeInTheDocument();
    });
  });
});