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

    const prevButton = screen.getByRole('button', { name: /Previous/i });
    const nextButton = screen.getByRole('button', { name: /Next/i });
    const pageButton = screen.getByRole('button', { name: '3' });

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

    const prevButton = screen.getByRole('button', { name: /Previous/i });
    const nextButton = screen.getByRole('button', { name: /Next/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(prevButton);
    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it('disables next button on last page', () => {
    render(<Pagination currentPage={5} total={50} pageSize={10} onPageChange={mockOnPageChange} />);

    const prevButton = screen.getByRole('button', { name: /Previous/i });
    const nextButton = screen.getByRole('button', { name: /Next/i });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();

    fireEvent.click(nextButton);
    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it('disables current page button', () => {
    render(<Pagination currentPage={3} total={50} pageSize={10} onPageChange={mockOnPageChange} />);

    const currentPageButton = screen.getByRole('button', { name: '3' });
    expect(currentPageButton).toBeDisabled();

    fireEvent.click(currentPageButton);
    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it('renders correct number of page buttons', () => {
    render(<Pagination currentPage={1} total={23} pageSize={5} onPageChange={mockOnPageChange} />);

    // Should have 5 pages (Math.ceil(23/5) = 5)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '6' })).not.toBeInTheDocument();
  });

  it('does not render when total pages is 1 or less', () => {
    const { container: container1 } = render(<Pagination currentPage={1} total={10} pageSize={10} onPageChange={mockOnPageChange} />);
    expect(container1.firstChild).toBeNull();

    const { container: container2 } = render(<Pagination currentPage={1} total={5} pageSize={10} onPageChange={mockOnPageChange} />);
    expect(container2.firstChild).toBeNull();
  });

  it('handles next button click correctly', () => {
    render(<Pagination currentPage={2} total={50} pageSize={10} onPageChange={mockOnPageChange} />);

    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('calculates total pages correctly with different page sizes', () => {
    render(<Pagination currentPage={1} total={100} pageSize={15} onPageChange={mockOnPageChange} />);

    // Should have 7 pages (Math.ceil(100/15) = 7)
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '8' })).not.toBeInTheDocument();
  });
});