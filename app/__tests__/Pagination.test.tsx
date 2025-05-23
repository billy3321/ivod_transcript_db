import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '@/components/Pagination';

describe('Pagination', () => {
  it('renders page buttons and handles clicks correctly', () => {
    const onPageChange = jest.fn();
    render(<Pagination currentPage={2} total={50} pageSize={10} onPageChange={onPageChange} />);

    const prevButton = screen.getByRole('button', { name: /Previous/i });
    const nextButton = screen.getByRole('button', { name: /Next/i });
    const pageButton = screen.getByRole('button', { name: '3' });

    expect(prevButton).not.toBeDisabled();
    expect(pageButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(pageButton);
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});