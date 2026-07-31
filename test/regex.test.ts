import { describe, expect, it } from 'vitest';
import { compileRegex, getRegexpPattern } from '../src/regex';

describe('compileRegex', () => {
  it('compiles a raw pattern case-insensitively', () => {
    const re = compileRegex('la.*ry');
    expect(re).toBeInstanceOf(RegExp);
    expect(re!.flags).toContain('i');
    expect('Laboratory'.match(re!)).not.toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(compileRegex('')).toBeNull();
  });

  it('returns null for an invalid pattern', () => {
    expect(compileRegex('(')).toBeNull();
  });
});

describe('getRegexpPattern', () => {
  it('parses the /pattern/flags form', () => {
    const re = getRegexpPattern('/lab/i');
    expect(re).toBeInstanceOf(RegExp);
    expect('LAB'.match(re!)).not.toBeNull();
  });

  it('returns null for plain (undelimited) text', () => {
    expect(getRegexpPattern('lab')).toBeNull();
  });
});
