import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');

/** Path to the built userscript (the artifact attached to releases). */
export const DIST_USERSCRIPT = resolve(
  projectRoot,
  'dist/amazon-wishlist-search.user.js',
);

/** Read the project's package.json. */
export const readPackageJson = (): { version: string; name: string } =>
  JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));

/** Read the built userscript, with a helpful error if it hasn't been built. */
export const readUserscript = (path: string = DIST_USERSCRIPT): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `Built userscript not found at ${path}. Run \`pnpm build\` first ` +
        `(\`pnpm test\` does this automatically via the pretest hook).`,
    );
  }
};

/**
 * Parse a userscript metadata block into a map of key -> values. A key may
 * appear multiple times (e.g. @include), so every value is collected.
 */
export const parseMetadata = (script: string): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const block = script.match(/==UserScript==([\s\S]*?)==\/UserScript==/);
  if (!block?.[1]) return map;

  for (const line of block[1].split('\n')) {
    const entry = line.match(/^\s*\/\/\s*@(\S+)\s+(.+?)\s*$/);
    if (!entry) continue;
    const [, key, value] = entry;
    if (key === undefined || value === undefined) continue;
    const values = map.get(key) ?? [];
    values.push(value);
    map.set(key, values);
  }
  return map;
};

/** Convenience: the first value of a metadata key, or null. */
export const metaValue = (
  meta: Map<string, string[]>,
  key: string,
): string | null => meta.get(key)?.[0] ?? null;
