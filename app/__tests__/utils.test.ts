import { formatCommitteeNames } from '@/lib/utils';

describe('formatCommitteeNames', () => {
  it('formats array of committee names', () => {
    const input = ['委員會A', '委員會B', '委員會C'];
    const result = formatCommitteeNames(input);
    expect(result).toBe('委員會A, 委員會B, 委員會C');
  });

  it('handles JSON string format (SQLite)', () => {
    const input = '["委員會A", "委員會B"]';
    const result = formatCommitteeNames(input);
    expect(result).toBe('委員會A, 委員會B');
  });

  it('handles invalid JSON string', () => {
    const input = 'invalid json';
    const result = formatCommitteeNames(input);
    expect(result).toBe('invalid json');
  });

  it('handles plain string', () => {
    const input = '單一委員會';
    const result = formatCommitteeNames(input);
    expect(result).toBe('單一委員會');
  });

  it('handles null input', () => {
    const result = formatCommitteeNames(null);
    expect(result).toBe('N/A');
  });

  it('handles undefined input', () => {
    const result = formatCommitteeNames(undefined);
    expect(result).toBe('N/A');
  });

  it('handles empty string', () => {
    const result = formatCommitteeNames('');
    expect(result).toBe('N/A');
  });

  it('handles empty array', () => {
    const result = formatCommitteeNames([]);
    expect(result).toBe('');
  });
});