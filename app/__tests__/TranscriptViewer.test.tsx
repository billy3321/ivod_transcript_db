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

  it('shows full text when expanded and collapses back', () => {
    const longText = 'a'.repeat(600);
    render(<TranscriptViewer transcript={longText} />);

    const expandButton = screen.getByRole('button', { name: /Expand/i });
    fireEvent.click(expandButton);

    expect(screen.getByText(longText)).toBeInTheDocument();
    expect(screen.queryByText(/\.\.\.$/)).not.toBeInTheDocument();

    const collapseButton = screen.getByRole('button', { name: /Collapse/i });
    fireEvent.click(collapseButton);

    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expand/i })).toBeInTheDocument();
  });

  it('handles exactly 500 characters without truncation', () => {
    const exactText = 'a'.repeat(500);
    render(<TranscriptViewer transcript={exactText} />);

    expect(screen.getByText(exactText)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/\.\.\.$/)).not.toBeInTheDocument();
  });

  it('shows truncation for 501 characters', () => {
    const slightlyLongText = 'a'.repeat(501);
    render(<TranscriptViewer transcript={slightlyLongText} />);

    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expand/i })).toBeInTheDocument();
  });

  it('preserves whitespace formatting in pre element', () => {
    const textWithSpaces = 'Line 1\n  Line 2 with spaces\n    Line 3 indented';
    render(<TranscriptViewer transcript={textWithSpaces} />);

    const preElement = document.querySelector('pre');
    expect(preElement).toBeInTheDocument();
    expect(preElement).toHaveClass('whitespace-pre-wrap');
    expect(preElement?.textContent).toBe(textWithSpaces);
  });

  it('handles empty transcript', () => {
    render(<TranscriptViewer transcript="" />);

    const preElement = document.querySelector('pre');
    expect(preElement).toBeInTheDocument();
    expect(preElement?.textContent).toBe('');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('handles single character transcript', () => {
    render(<TranscriptViewer transcript="a" />);

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('maintains state correctly through multiple toggles', () => {
    const longText = 'b'.repeat(600);
    render(<TranscriptViewer transcript={longText} />);

    const expandButton = screen.getByRole('button', { name: /Expand/i });
    
    // Expand
    fireEvent.click(expandButton);
    expect(screen.getByText(longText)).toBeInTheDocument();
    
    // Collapse
    const collapseButton = screen.getByRole('button', { name: /Collapse/i });
    fireEvent.click(collapseButton);
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    
    // Expand again
    const expandButton2 = screen.getByRole('button', { name: /Expand/i });
    fireEvent.click(expandButton2);
    expect(screen.getByText(longText)).toBeInTheDocument();
  });
});