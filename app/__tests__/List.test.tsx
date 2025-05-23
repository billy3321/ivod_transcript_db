import React from 'react';
import { render, screen } from '@testing-library/react';
import List from '@/components/List';

describe('List', () => {
  it('renders table rows with provided items', () => {
    const items = [
      {
        ivod_id: 1,
        date: '2022-01-01',
        meeting_name: 'MeetingOne',
        committee_names: ['A', 'B'],
        speaker_name: 'SpeakerOne',
        video_length: '10:00',
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('MeetingOne')).toBeInTheDocument();
    expect(screen.getByText('A, B')).toBeInTheDocument();
    expect(screen.getByText('SpeakerOne')).toBeInTheDocument();
  });
});