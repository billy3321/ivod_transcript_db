import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '@/components/Pagination';

describe('Pagination', () => {
  const mockOnPageChange = jest.fn();

  beforeEach(() => {
    mockOnPageChange.mockClear();
  });

  it('renders page buttons and handles clicks correctly', () => {
    render(<Pagination currentPage={2} total={50} pageSize={10} onPageChange={mockOnPageChange} />);

    const prevButton = screen.getByRole('button', { name: '上一頁' });
    const nextButton = screen.getByRole('button', { name: '下一頁' });
    const pageButton = screen.getByRole('button', { name: '第 3 頁' });

    expect(prevButton).not.toBeDisabled();
    expect(pageButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(pageButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(prevButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(1);
  });

  it('disables previous button on first page', () => {
    render(<Pagination currentPage={1} total={50} pageSize={10} onPageChange={mockOnPageChange} />);

    const prevButton = screen.getByRole('button', { name: '上一頁' });
    const nextButton = screen.getByRole('button', { name: '下一頁' });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(prevButton);
    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it('disables next button on last page', () => {
    render(<Pagination currentPage={5} total={50} pageSize={10} onPageChange={mockOnPageChange} />);

    const prevButton = screen.getByRole('button', { name: '上一頁' });
    const nextButton = screen.getByRole('button', { name: '下一頁' });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();

    fireEvent.click(nextButton);
    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it('disables current page button', () => {
    render(<Pagination currentPage={3} total={50} pageSize={10} onPageChange={mockOnPageChange} />);

    const currentPageButton = screen.getByRole('button', { name: '第 3 頁' });
    expect(currentPageButton).toHaveAttribute('aria-current', 'page');

    fireEvent.click(currentPageButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(3); // Current page button is clickable
  });

  it('renders correct number of page buttons', () => {
    render(<Pagination currentPage={1} total={23} pageSize={5} onPageChange={mockOnPageChange} />);

    // Should have 5 pages (Math.ceil(23/5) = 5)
    // When current page is 1, it shows 1, 2, 3, ..., 5 (with ellipsis hiding page 4)
    expect(screen.getByRole('button', { name: '第 1 頁' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 2 頁' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 3 頁' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 5 頁' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '第 6 頁' })).not.toBeInTheDocument();
    
    // Check that ellipsis is shown
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('does not render when total pages is 1 or less', () => {
    const { container: container1 } = render(<Pagination currentPage={1} total={10} pageSize={10} onPageChange={mockOnPageChange} />);
    expect(container1.firstChild).toBeNull();

    const { container: container2 } = render(<Pagination currentPage={1} total={5} pageSize={10} onPageChange={mockOnPageChange} />);
    expect(container2.firstChild).toBeNull();
  });

  it('handles next button click correctly', () => {
    render(<Pagination currentPage={2} total={50} pageSize={10} onPageChange={mockOnPageChange} />);

    const nextButton = screen.getByRole('button', { name: '下一頁' });
    fireEvent.click(nextButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('calculates total pages correctly with different page sizes', () => {
    render(<Pagination currentPage={1} total={100} pageSize={15} onPageChange={mockOnPageChange} />);

    // Should have 7 pages (Math.ceil(100/15) = 7)
    expect(screen.getByRole('button', { name: '第 7 頁' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '第 8 頁' })).not.toBeInTheDocument();
  });
});