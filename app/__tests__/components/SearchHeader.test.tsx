import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchHeader, { SearchScope } from '@/components/SearchHeader';

describe('SearchHeader', () => {
  const defaultProps = {
    searchQuery: '',
    setSearchQuery: jest.fn(),
    searchScope: 'all' as SearchScope,
    setSearchScope: jest.fn(),
    sortOrder: 'date_desc' as const,
    setSortOrder: jest.fn(),
    advancedInput: {
      meeting_name: '',
      speaker: '',
      committee: '',
      date_from: '',
      date_to: '',
    },
    setAdvancedInput: jest.fn(),
    showAdvancedSearch: false,
    setShowAdvancedSearch: jest.fn(),
    hasActiveFilters: false,
    onSearch: jest.fn(),
    onClearFilters: jest.fn(),
    onKeyPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders main search input', () => {
    render(<SearchHeader {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveValue('');
  });

  it('displays search query value', () => {
    render(<SearchHeader {...defaultProps} searchQuery="test query" />);
    
    const searchInput = screen.getByDisplayValue('test query');
    expect(searchInput).toBeInTheDocument();
  });

  it('calls setSearchQuery when typing in search input', () => {
    render(<SearchHeader {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
    fireEvent.change(searchInput, { target: { value: 'new search' } });
    
    expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('new search');
  });

  it('calls onKeyPress when pressing Enter', () => {
    render(<SearchHeader {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
    fireEvent.keyPress(searchInput, { key: 'Enter' });
    
    expect(defaultProps.onKeyPress).toHaveBeenCalled();
  });

  it('renders search scope selector', () => {
    render(<SearchHeader {...defaultProps} />);
    
    const scopeSelect = screen.getByDisplayValue('搜尋全部欄位');
    expect(scopeSelect).toBeInTheDocument();
    expect(screen.getByText('僅搜尋逐字稿')).toBeInTheDocument();
  });

  it('calls setSearchScope when scope is changed', () => {
    render(<SearchHeader {...defaultProps} />);
    
    const scopeSelect = screen.getByDisplayValue('搜尋全部欄位');
    fireEvent.change(scopeSelect, { target: { value: 'transcript' } });
    
    expect(defaultProps.setSearchScope).toHaveBeenCalledWith('transcript');
  });

  it('renders sort order selector', () => {
    render(<SearchHeader {...defaultProps} />);
    
    expect(screen.getByLabelText('最新的在前')).toBeInTheDocument();
    expect(screen.getByLabelText('最舊的在前')).toBeInTheDocument();
  });

  it('calls setSortOrder when sort order is changed', () => {
    render(<SearchHeader {...defaultProps} />);
    
    const oldestFirst = screen.getByLabelText('最舊的在前');
    fireEvent.click(oldestFirst);
    
    expect(defaultProps.setSortOrder).toHaveBeenCalledWith('date_asc');
  });

  it('renders search button', () => {
    render(<SearchHeader {...defaultProps} />);
    
    const searchButton = screen.getByRole('button', { name: '搜尋' });
    expect(searchButton).toBeInTheDocument();
  });

  it('calls onSearch when search button is clicked', () => {
    render(<SearchHeader {...defaultProps} />);
    
    const searchButton = screen.getByRole('button', { name: '搜尋' });
    fireEvent.click(searchButton);
    
    expect(defaultProps.onSearch).toHaveBeenCalled();
  });

  describe('Advanced Search', () => {
    it('shows advanced search toggle button', () => {
      render(<SearchHeader {...defaultProps} />);
      
      const toggleButton = screen.getByRole('button', { name: '進階搜尋' });
      expect(toggleButton).toBeInTheDocument();
    });

    it('calls setShowAdvancedSearch when toggle is clicked', () => {
      render(<SearchHeader {...defaultProps} />);
      
      const toggleButton = screen.getByRole('button', { name: '進階搜尋' });
      fireEvent.click(toggleButton);
      
      expect(defaultProps.setShowAdvancedSearch).toHaveBeenCalledWith(true);
    });

    it('renders advanced search form when expanded', () => {
      render(<SearchHeader {...defaultProps} showAdvancedSearch={true} />);
      
      expect(screen.getByPlaceholderText('會議名稱')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('立委姓名')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('委員會名稱')).toBeInTheDocument();
      expect(screen.getByLabelText('日期 從')).toBeInTheDocument();
      expect(screen.getByLabelText('日期 到')).toBeInTheDocument();
    });

    it('calls setAdvancedInput when advanced fields are changed', () => {
      render(<SearchHeader {...defaultProps} showAdvancedSearch={true} />);
      
      const meetingInput = screen.getByPlaceholderText('會議名稱');
      fireEvent.change(meetingInput, { target: { value: '預算會議' } });
      
      expect(defaultProps.setAdvancedInput).toHaveBeenCalledWith({
        ...defaultProps.advancedInput,
        meeting_name: '預算會議',
      });
    });

    it('renders clear filters button when hasActiveFilters is true', () => {
      render(<SearchHeader {...defaultProps} hasActiveFilters={true} />);
      
      const clearButton = screen.getByRole('button', { name: '清除篩選條件' });
      expect(clearButton).toBeInTheDocument();
    });

    it('calls onClearFilters when clear button is clicked', () => {
      render(<SearchHeader {...defaultProps} hasActiveFilters={true} />);
      
      const clearButton = screen.getByRole('button', { name: '清除篩選條件' });
      fireEvent.click(clearButton);
      
      expect(defaultProps.onClearFilters).toHaveBeenCalled();
    });

    it('does not render clear filters button when hasActiveFilters is false', () => {
      render(<SearchHeader {...defaultProps} hasActiveFilters={false} />);
      
      const clearButton = screen.queryByRole('button', { name: '清除篩選條件' });
      expect(clearButton).not.toBeInTheDocument();
    });
  });

  describe('Advanced Search Values', () => {
    const advancedInputWithValues = {
      meeting_name: '預算會議',
      speaker: '王委員',
      committee: '財政委員會',
      date_from: '2024-01-01',
      date_to: '2024-12-31',
    };

    it('displays advanced search values correctly', () => {
      render(<SearchHeader 
        {...defaultProps} 
        showAdvancedSearch={true}
        advancedInput={advancedInputWithValues}
      />);
      
      expect(screen.getByDisplayValue('預算會議')).toBeInTheDocument();
      expect(screen.getByDisplayValue('王委員')).toBeInTheDocument();
      expect(screen.getByDisplayValue('財政委員會')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and structure', () => {
      render(<SearchHeader {...defaultProps} showAdvancedSearch={true} />);
      
      // Check main search input accessibility
      const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
      expect(searchInput).toHaveAttribute('type', 'text');
      
      // Check radio button groups
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      
      // Check date inputs have proper labels
      expect(screen.getByLabelText('日期 從')).toHaveAttribute('type', 'date');
      expect(screen.getByLabelText('日期 到')).toHaveAttribute('type', 'date');
    });

    it('has proper button roles and labels', () => {
      render(<SearchHeader {...defaultProps} />);
      
      const searchButton = screen.getByRole('button', { name: '搜尋' });
      expect(searchButton).toHaveAttribute('type', 'button');
      
      const advancedToggle = screen.getByRole('button', { name: '進階搜尋' });
      expect(advancedToggle).toHaveAttribute('type', 'button');
    });
  });
});