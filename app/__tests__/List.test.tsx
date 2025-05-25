import React from 'react';
import { render, screen } from '@testing-library/react';
import List from '@/components/List';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

describe('List', () => {
  it('renders IVOD cards with provided items', () => {
    const items = [
      {
        ivod_id: 1,
        date: '2022-01-01',
        meeting_name: 'Test Meeting',
        committee_names: ['委員會A', '委員會B'],
        speaker_name: 'Test Speaker',
        video_length: '10:00',
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('Test Meeting')).toBeInTheDocument();
    expect(screen.getByText('委員會A, 委員會B')).toBeInTheDocument();
    expect(screen.getByText('Test Speaker')).toBeInTheDocument();
    expect(screen.getByText('2022-01-01')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('handles string format committee names (SQLite)', () => {
    const items = [
      {
        ivod_id: 2,
        date: '2022-01-02',
        meeting_name: 'Test Meeting 2',
        committee_names: '["委員會C", "委員會D"]',
        speaker_name: 'Test Speaker 2',
        video_length: '15:00',
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('Test Meeting 2')).toBeInTheDocument();
    expect(screen.getByText('委員會C, 委員會D')).toBeInTheDocument();
  });

  it('handles null committee names', () => {
    const items = [
      {
        ivod_id: 3,
        date: '2022-01-03',
        meeting_name: 'Test Meeting 3',
        committee_names: null,
        speaker_name: 'Test Speaker 3',
        video_length: '20:00',
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('Test Meeting 3')).toBeInTheDocument();
    // Note: The committee names section won't render if committee_names is null
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('renders proper links to IVOD detail pages', () => {
    const items = [
      {
        ivod_id: 123,
        date: '2022-01-01',
        meeting_name: 'Test Meeting',
        committee_names: ['委員會A'],
        speaker_name: 'Test Speaker',
        video_length: '10:00',
      },
    ];
    render(<List items={items} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/ivod/123');
  });

  it('handles empty items array', () => {
    render(<List items={[]} />);
    
    // Should render empty container without errors
    const container = document.querySelector('.space-y-4');
    expect(container).toBeInTheDocument();
    expect(container?.children).toHaveLength(0);
  });
});