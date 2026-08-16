import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Read a captured Amazon response from `test/fixtures/`.
 *
 * These are real response bodies recorded from a live session, kept verbatim so
 * the protocol tests fail if Amazon's format drifts rather than if our idea of
 * it drifts.
 */
export const readFixture = (name: string): string =>
  readFileSync(resolve(here, 'fixtures', name), 'utf8');
