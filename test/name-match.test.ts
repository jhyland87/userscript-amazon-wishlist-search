import { describe, expect, it } from 'vitest';

import { findNameMatch, normalizeName } from '../src/name-match';

describe('normalizeName', () => {
  it('collapses the newline runs Amazon leaves inside a name', () => {
    expect(normalizeName(' 3D\n                    Printer/Filaments ')).toBe(
      '3D Printer/Filaments',
    );
  });

  it('leaves an already-clean name alone', () => {
    expect(normalizeName('Chem/Glassware')).toBe('Chem/Glassware');
  });
});

describe('findNameMatch', () => {
  it('matches a wrapped name the user typed with a plain space', () => {
    const name = normalizeName('3D\n        Printer/Resin Printer');
    expect(findNameMatch(name, /3d printer/i, '3d printer')).toEqual({
      start: 0,
      end: 10,
    });
  });

  it('returns the offsets of the occurrence the pattern found', () => {
    expect(findNameMatch('Books/Chemistry', /chem/i, 'chem')).toEqual({
      start: 6,
      end: 10,
    });
  });

  it('returns null when the name does not match', () => {
    expect(findNameMatch('Tools', /chem/i, 'chem')).toBeNull();
  });

  it('falls back to a case-insensitive literal when there is no pattern', () => {
    expect(findNameMatch('Chem/Glassware', null, 'GLASS')).toEqual({
      start: 5,
      end: 10,
    });
    expect(findNameMatch('Chem/Glassware', null, 'nope')).toBeNull();
  });
});
