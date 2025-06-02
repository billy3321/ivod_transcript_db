import React from 'react';
import { render, screen } from '@testing-library/react';
import List from '@/components/List';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return React.forwardRef(function MockLink(props: any, ref: any) {
    const { children, href, ...otherProps } = props;
    return <a href={href} ref={ref} {...otherProps}>{children}</a>;
  });
});

describe('List', () => {
  it('renders IVOD cards with provided items', () => {
    const items = [
      {
        ivod_id: 1,
        date: '2022-01-01',
        title: null,
        meeting_name: 'Test Meeting',
        committee_names: ['委員會A', '委員會B'],
        speaker_name: 'Test Speaker',
        video_length: '10:00',
        video_start: null,
        video_end: null,
        video_type: 'speech',
        category: null,
        meeting_code: null,
        meeting_code_str: null,
        meeting_time: null,
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('Test Meeting（Test Speaker 發言）')).toBeInTheDocument();
    expect(screen.getByText('委員會A, 委員會B')).toBeInTheDocument();
    expect(screen.getByText('2022-01-01')).toBeInTheDocument();
    expect(screen.getByText('時長: 10:00')).toBeInTheDocument();
    expect(screen.getByText('發言')).toBeInTheDocument();
  });

  it('handles string format committee names (SQLite)', () => {
    const items = [
      {
        ivod_id: 2,
        date: '2022-01-02',
        title: null,
        meeting_name: 'Test Meeting 2',
        committee_names: '["委員會C", "委員會D"]',
        speaker_name: 'Test Speaker 2',
        video_length: '15:00',
        video_start: null,
        video_end: null,
        video_type: null,
        category: null,
        meeting_code: null,
        meeting_code_str: null,
        meeting_time: null,
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('Test Meeting 2（Test Speaker 2 發言）')).toBeInTheDocument();
    expect(screen.getByText('委員會C, 委員會D')).toBeInTheDocument();
  });

  it('handles null committee names', () => {
    const items = [
      {
        ivod_id: 3,
        date: '2022-01-03',
        title: null,
        meeting_name: 'Test Meeting 3',
        committee_names: null,
        speaker_name: 'Test Speaker 3',
        video_length: '20:00',
        video_start: null,
        video_end: null,
        video_type: null,
        category: null,
        meeting_code: null,
        meeting_code_str: null,
        meeting_time: null,
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('Test Meeting 3（Test Speaker 3 發言）')).toBeInTheDocument();
    // Note: The committee names section won't render if committee_names is null
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('renders proper links to IVOD detail pages', () => {
    const items = [
      {
        ivod_id: 123,
        date: '2022-01-01',
        title: null,
        meeting_name: 'Test Meeting',
        committee_names: ['委員會A'],
        speaker_name: 'Test Speaker',
        video_length: '10:00',
        video_start: null,
        video_end: null,
        video_type: null,
        category: null,
        meeting_code: null,
        meeting_code_str: null,
        meeting_time: null,
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

  it('renders "完整會議" speaker format correctly', () => {
    const items = [
      {
        ivod_id: 4,
        date: '2022-01-04',
        title: '重要會議',
        meeting_name: 'Full Committee Meeting',
        committee_names: ['委員會A'],
        speaker_name: '完整會議',
        video_length: '120:00',
        video_start: '09:00:00',
        video_end: '11:00:00',
        video_type: 'full',
        category: 'committee',
        meeting_code: 'MTG001',
        meeting_code_str: null,
        meeting_time: null,
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('重要會議（完整會議）')).toBeInTheDocument();
    expect(screen.getByText('完整會議')).toBeInTheDocument();
    expect(screen.getByText('09:00:00 - 11:00:00')).toBeInTheDocument();
  });

  it('displays additional metadata fields when available', () => {
    const items = [
      {
        ivod_id: 5,
        date: '2022-01-05',
        title: '測試標題',
        meeting_name: '測試會議',
        committee_names: ['委員會B'],
        speaker_name: '張委員',
        video_length: '45:30',
        video_start: '14:30:00',
        video_end: '15:15:30',
        video_type: 'clip',
        category: '質詢',
        meeting_code: null,
        meeting_code_str: 'TEST-002',
        meeting_time: '2022-01-05 14:30:00+08:00',
      },
    ];
    render(<List items={items} />);

    expect(screen.getByText('測試標題（張委員 發言）')).toBeInTheDocument();
    expect(screen.getByText('片段')).toBeInTheDocument();
    expect(screen.getByText('質詢')).toBeInTheDocument();
    expect(screen.getByText('14:30:00 - 15:15:30')).toBeInTheDocument();
  });

  it('displays search excerpt when available', () => {
    const items = [
      {
        ivod_id: 6,
        date: '2022-01-06',
        title: '搜尋測試',
        meeting_name: '搜尋會議',
        committee_names: ['搜尋委員會'],
        speaker_name: '測試委員',
        video_length: '30:00',
        video_start: null,
        video_end: null,
        video_type: null,
        category: null,
        meeting_code: null,
        meeting_code_str: null,
        meeting_time: null,
        excerpt: {
          text: '這是一段包含<mark class="bg-red-200 text-red-800 px-1 rounded">搜尋關鍵字</mark>的摘要文字...',
          plainText: '這是一段包含搜尋關鍵字的摘要文字...',
          hasMatch: true,
          matchPosition: 6
        }
      },
    ];
    render(<List items={items} />);

    // Check if search excerpt section is displayed
    expect(screen.getByText('搜尋結果摘要')).toBeInTheDocument();
    
    // Check if the highlighted content is present
    const excerptContainer = screen.getByText(/這是一段包含.*搜尋關鍵字.*的摘要文字/);
    expect(excerptContainer).toBeInTheDocument();
  });

  it('does not display search excerpt when not available', () => {
    const items = [
      {
        ivod_id: 7,
        date: '2022-01-07',
        title: '無摘要測試',
        meeting_name: '無摘要會議',
        committee_names: ['測試委員會'],
        speaker_name: '測試委員',
        video_length: '20:00',
        video_start: null,
        video_end: null,
        video_type: null,
        category: null,
        meeting_code: null,
        meeting_code_str: null,
        meeting_time: null,
        // No excerpt property
      },
    ];
    render(<List items={items} />);

    // Should not show search excerpt section
    expect(screen.queryByText('搜尋結果摘要')).not.toBeInTheDocument();
  });

  it('does not display search excerpt when hasMatch is false', () => {
    const items = [
      {
        ivod_id: 8,
        date: '2022-01-08',
        title: '無匹配測試',
        meeting_name: '無匹配會議',
        committee_names: ['測試委員會'],
        speaker_name: '測試委員',
        video_length: '25:00',
        video_start: null,
        video_end: null,
        video_type: null,
        category: null,
        meeting_code: null,
        meeting_code_str: null,
        meeting_time: null,
        excerpt: {
          text: '',
          plainText: '',
          hasMatch: false,
          matchPosition: -1
        }
      },
    ];
    render(<List items={items} />);

    // Should not show search excerpt section
    expect(screen.queryByText('搜尋結果摘要')).not.toBeInTheDocument();
  });
});