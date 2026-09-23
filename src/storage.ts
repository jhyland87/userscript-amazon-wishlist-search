import { GM } from 'vite-plugin-monkey/dist/client';
import { STORAGE_KEYS } from './config';
import { log } from './log';

/**
 * Persistent storage, backed by the userscript manager's `GM.*` value API.
 *
 * Values are stored as typed JSON (no string coercion), are private to the
 * script, and are shared across every Amazon host. Everything else in the
 * script goes through these helpers so the `GM` dependency lives in one place.
 */

/**
 * Read a stored value, accepting it only if it passes `guard`.
 *
 * @param key - The storage key (see `STORAGE_KEYS`).
 * @param guard - Type guard the stored value must satisfy.
 * @returns The stored value, or `undefined` when missing, invalid or unreadable.
 * @example
 * await readStored('wishlist-search:debug', isBoolean); // true
 * await readStored('missing-key', isBoolean); // undefined
 * @category Storage
 * @group Storage
 * @source src/storage.ts
 */
export const readStored = async <T>(
  key: string,
  guard: (value: unknown) => value is T,
): Promise<T | undefined> => {
  try {
    const value = await GM.getValue<unknown>(key);
    return guard(value) ? value : undefined;
  } catch (err) {
    log.warn(`failed to read ${key}`, err);
    return undefined;
  }
};

/**
 * Persist a value. Failures are logged, never thrown, so callers can fire and
 * forget with `void`.
 *
 * @param key - The storage key (see `STORAGE_KEYS`).
 * @param value - Any JSON-serializable value.
 * @returns Resolves once the value is written.
 * @example
 * void writeStored('wishlist-search:debug', true);
 * @category Storage
 * @group Storage
 * @source src/storage.ts
 */
export const writeStored = async (key: string, value: unknown): Promise<void> => {
  try {
    await GM.setValue(key, value);
  } catch (err) {
    log.warn(`failed to persist ${key}`, err);
  }
};

/**
 * Remove a stored value. Failures are logged, never thrown.
 *
 * @param key - The storage key (see `STORAGE_KEYS`).
 * @returns Resolves once the value is removed.
 * @example
 * void deleteStored('wishlist-search:frequent-lists');
 * @category Storage
 * @group Storage
 * @source src/storage.ts
 */
export const deleteStored = async (key: string): Promise<void> => {
  try {
    await GM.deleteValue(key);
  } catch (err) {
    log.warn(`failed to delete ${key}`, err);
  }
};

/**
 * Run `callback` when another tab changes `key`, so in-memory caches don't go
 * stale (and don't overwrite that tab's writes). Changes made by this tab are
 * ignored, since its cache is already current.
 *
 * @param key - The storage key to watch.
 * @param guard - Type guard the new value must satisfy.
 * @param callback - Receives the new value, or `undefined` if it was deleted
 *   or is invalid.
 * @returns Nothing.
 * @example
 * onStoredChange('wishlist-search:debug', isBoolean, (value) => {
 *   enabled = value ?? CONFIG.debug;
 * });
 * @category Storage
 * @group Storage
 * @source src/storage.ts
 */
export const onStoredChange = <T>(
  key: string,
  guard: (value: unknown) => value is T,
  callback: (value: T | undefined) => void,
): void => {
  const listen = async (): Promise<void> => {
    try {
      await GM.addValueChangeListener<unknown>(key, (_name, _old, value, remote) => {
        if (!remote) return;
        callback(guard(value) ? value : undefined);
      });
    } catch (err) {
      log.warn(`failed to watch ${key}`, err);
    }
  };
  void listen();
};

/**
 * Type guard for stored on/off flags.
 *
 * @param value - Any stored value.
 * @returns `true` if `value` is a boolean.
 * @example
 * isBoolean(false); // true
 * isBoolean('false'); // false
 * @category Storage
 * @group Storage
 * @source src/storage.ts
 */
export const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

/**
 * Parse one legacy `localStorage` string. Flags were saved as `'true'`/`'false'`
 * and maps/lists as JSON, so `JSON.parse` restores both to their typed form.
 */
const parseLegacy = (key: string, raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch (err) {
    log.warn(`skipping unreadable legacy value for ${key}`, err);
    return undefined;
  }
};

/**
 * Move values saved by versions that used `localStorage` into GM storage, then
 * drop the old keys. A key that already exists in GM storage wins, and a value
 * that can't be parsed is left in place rather than lost.
 *
 * @returns Resolves once every legacy key has been handled.
 * @example
 * // localStorage: {'wishlist-search:debug': 'true'}
 * await migrateLegacyStorage();
 * // GM storage: {'wishlist-search:debug': true}; localStorage key removed
 * @category Storage
 * @group Storage
 * @source src/storage.ts
 */
export const migrateLegacyStorage = async (): Promise<void> => {
  try {
    const existing = new Set(await GM.listValues());
    for (const key of Object.values(STORAGE_KEYS)) {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      if (!existing.has(key)) {
        const value = parseLegacy(key, raw);
        // Leave an unparseable value in place rather than lose it.
        if (value === undefined) continue;
        await GM.setValue(key, value);
      }
      localStorage.removeItem(key);
    }
  } catch (err) {
    log.warn('failed to migrate legacy localStorage values', err);
  }
};
