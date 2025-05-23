import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TranscriptViewer from '@/components/TranscriptViewer';

describe('TranscriptViewer', () => {
  it('shows truncated text and toggles expand/collapse for long transcripts', () => {
    const longText = 'a'.repeat(600);
    render(<TranscriptViewer transcript={longText} />);

    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    const expandButton = screen.getByRole('button', { name: /Expand/i });
    fireEvent.click(expandButton);
    expect(screen.getByRole('button', { name: /Collapse/i })).toBeInTheDocument();
  });

  it('shows full text without toggle for short transcripts', () => {
    const shortText = 'short transcript';
    render(<TranscriptViewer transcript={shortText} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(shortText)).toBeInTheDocument();
  });
});