import { describe, it, expect } from 'vitest';
import { pageArgs, calcHours, parseNumber, cleanStr, parseCSVLine, getMondayOf } from '../lib/helpers.js';

describe('pageArgs', () => {
  it('returns paged:false when no limit is given', () => {
    expect(pageArgs({ query: {} })).toEqual({ paged: false, limit: null, offset: 0 });
  });
  it('parses a positive limit and offset', () => {
    expect(pageArgs({ query: { limit: '25', offset: '50' } })).toEqual({ paged: true, limit: 25, offset: 50 });
  });
  it('caps limit at 500 and floors offset at 0', () => {
    expect(pageArgs({ query: { limit: '9999', offset: '-5' } })).toEqual({ paged: true, limit: 500, offset: 0 });
  });
  it('treats a zero/negative limit as no pagination', () => {
    expect(pageArgs({ query: { limit: '0' } }).paged).toBe(false);
  });
});

describe('calcHours', () => {
  it('computes whole hours', () => {
    expect(calcHours('2026-06-02T09:00:00Z', '2026-06-02T17:00:00Z')).toBe(8);
  });
  it('rounds to the nearest quarter hour', () => {
    expect(calcHours('2026-06-02T09:00:00Z', '2026-06-02T09:10:00Z')).toBe(0.25);
  });
  it('returns 0 when input is missing', () => {
    expect(calcHours(null, '2026-06-02T17:00:00Z')).toBe(0);
  });
});

describe('parseNumber', () => {
  it('strips quotes and thousands separators', () => {
    expect(parseNumber('"1,234.5"')).toBe(1234.5);
  });
  it('returns 0 for non-numeric input', () => {
    expect(parseNumber('abc')).toBe(0);
  });
});

describe('cleanStr', () => {
  it('removes control characters and trims', () => {
    expect(cleanStr('  a\tb\r\nc  ')).toBe('abc');
  });
  it('handles empty input', () => {
    expect(cleanStr('')).toBe('');
  });
});

describe('parseCSVLine', () => {
  it('splits a simple line', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('keeps commas inside quotes', () => {
    expect(parseCSVLine('"a,b",c')).toEqual(['a,b', 'c']);
  });
  it('handles escaped double quotes', () => {
    expect(parseCSVLine('"a""b",c')).toEqual(['a"b', 'c']);
  });
});

describe('getMondayOf', () => {
  it('returns the Monday of the given week', () => {
    const monday = getMondayOf('2026-06-03T12:00:00'); // a Wednesday
    expect(monday.getDay()).toBe(1);
  });
});
