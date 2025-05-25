import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchForm from '@/components/SearchForm';

describe('SearchForm', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
  });

  it('renders inputs with initial values and calls onSearch on submit', () => {
    const filters = { meetingName: 'Meeting1', committee: 'Comm1', speaker: 'Speaker1' };
    render(<SearchForm filters={filters} onSearch={mockOnSearch} />);

    const meetingInput = screen.getByLabelText(/Meeting Name/i);
    const committeeInput = screen.getByLabelText(/Committee/i);
    const speakerInput = screen.getByLabelText(/Speaker/i);
    const button = screen.getByRole('button', { name: /Search/i });

    expect(meetingInput).toHaveValue(filters.meetingName);
    expect(committeeInput).toHaveValue(filters.committee);
    expect(speakerInput).toHaveValue(filters.speaker);

    fireEvent.change(meetingInput, { target: { value: 'NewMeeting' } });
    fireEvent.click(button);
    expect(mockOnSearch).toHaveBeenCalledWith({ ...filters, meetingName: 'NewMeeting' });
  });

  it('renders with empty filters and handles input changes', () => {
    const filters = {};
    render(<SearchForm filters={filters} onSearch={mockOnSearch} />);

    const meetingInput = screen.getByLabelText(/Meeting Name/i);
    const committeeInput = screen.getByLabelText(/Committee/i);
    const speakerInput = screen.getByLabelText(/Speaker/i);

    expect(meetingInput).toHaveValue('');
    expect(committeeInput).toHaveValue('');
    expect(speakerInput).toHaveValue('');

    fireEvent.change(meetingInput, { target: { value: 'Test Meeting' } });
    fireEvent.change(committeeInput, { target: { value: 'Test Committee' } });
    fireEvent.change(speakerInput, { target: { value: 'Test Speaker' } });

    expect(meetingInput).toHaveValue('Test Meeting');
    expect(committeeInput).toHaveValue('Test Committee');
    expect(speakerInput).toHaveValue('Test Speaker');
  });

  it('handles form submission with enter key', () => {
    const filters = { meetingName: 'Initial Meeting' };
    render(<SearchForm filters={filters} onSearch={mockOnSearch} />);

    const form = document.querySelector('form');
    expect(form).toBeInTheDocument();

    fireEvent.submit(form!);
    expect(mockOnSearch).toHaveBeenCalledWith(filters);
  });

  it('handles multiple field changes before submission', () => {
    const filters = {};
    render(<SearchForm filters={filters} onSearch={mockOnSearch} />);

    const meetingInput = screen.getByLabelText(/Meeting Name/i);
    const committeeInput = screen.getByLabelText(/Committee/i);
    const speakerInput = screen.getByLabelText(/Speaker/i);
    const button = screen.getByRole('button', { name: /Search/i });

    fireEvent.change(meetingInput, { target: { value: 'Meeting A' } });
    fireEvent.change(committeeInput, { target: { value: 'Committee B' } });
    fireEvent.change(speakerInput, { target: { value: 'Speaker C' } });
    fireEvent.click(button);

    expect(mockOnSearch).toHaveBeenCalledWith({
      meetingName: 'Meeting A',
      committee: 'Committee B',
      speaker: 'Speaker C'
    });
  });
});