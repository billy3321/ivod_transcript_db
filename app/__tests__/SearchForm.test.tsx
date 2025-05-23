import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchForm from '@/components/SearchForm';

describe('SearchForm', () => {
  it('renders inputs with initial values and calls onSearch on submit', () => {
    const filters = { meetingName: 'Meeting1', committee: 'Comm1', speaker: 'Speaker1' };
    const onSearch = jest.fn();
    render(<SearchForm filters={filters} onSearch={onSearch} />);

    const meetingInput = screen.getByLabelText(/Meeting Name/i);
    const committeeInput = screen.getByLabelText(/Committee/i);
    const speakerInput = screen.getByLabelText(/Speaker/i);
    const button = screen.getByRole('button', { name: /Search/i });

    expect(meetingInput).toHaveValue(filters.meetingName);
    expect(committeeInput).toHaveValue(filters.committee);
    expect(speakerInput).toHaveValue(filters.speaker);

    fireEvent.change(meetingInput, { target: { value: 'NewMeeting' } });
    fireEvent.click(button);
    expect(onSearch).toHaveBeenCalledWith({ ...filters, meetingName: 'NewMeeting' });
  });
});