import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractSection, normalizeVersion } from '../tools/extractChangelog.js';
import { readPackageJson } from './userscript-meta';

const CHANGELOG = [
  '# Changelog',
  '',
  'Preamble prose that must never be picked up.',
  '',
  '## [Unreleased]',
  '',
  '## [0.3.0] - 2026-07-31',
  '',
  '### Added',
  '',
  '- A control',
  '',
  '## [0.2.0] - 2026-06-19',
  '',
  'Released before this changelog existed.',
  '',
].join('\n');

describe('normalizeVersion', () => {
  it.each([
    ['v0.3.0', '0.3.0'],
    ['V0.3.0', '0.3.0'],
    ['0.3.0', '0.3.0'],
    ['  v0.3.0  ', '0.3.0'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeVersion(input)).toBe(expected);
  });
});

describe('extractSection', () => {
  it("returns only the requested version's body", () => {
    expect(extractSection(CHANGELOG, '0.3.0')).toBe(
      ['### Added', '', '- A control'].join('\n'),
    );
  });

  it('matches a tag with a leading v', () => {
    expect(extractSection(CHANGELOG, 'v0.3.0')).toBe(extractSection(CHANGELOG, '0.3.0'));
  });

  it('stops at the next version heading', () => {
    expect(extractSection(CHANGELOG, '0.3.0')).not.toContain('0.2.0');
  });

  it('never returns the file preamble', () => {
    expect(extractSection(CHANGELOG, '0.3.0')).not.toContain('Preamble');
  });

  // The workflow treats undefined as "fall back to generated notes".
  it('returns undefined for a version with no section', () => {
    expect(extractSection(CHANGELOG, '9.9.9')).toBeUndefined();
  });

  it('returns undefined for a section with no content', () => {
    expect(extractSection('## [1.0.0]\n\n## [0.9.0]\n\n- x\n', '1.0.0')).toBeUndefined();
  });

  it('handles CRLF line endings', () => {
    expect(extractSection(CHANGELOG.replace(/\n/g, '\r\n'), '0.3.0')).toContain('- A control');
  });
});

describe("the repo's own CHANGELOG.md", () => {
  const changelogPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'CHANGELOG.md',
  );
  const changelog = readFileSync(changelogPath, 'utf8');

  // Guards the release workflow: a tag with no section silently falls back to
  // the near-empty auto-generated notes.
  it('has a section for the current package version', () => {
    expect(extractSection(changelog, readPackageJson().version)).toBeDefined();
  });
});
