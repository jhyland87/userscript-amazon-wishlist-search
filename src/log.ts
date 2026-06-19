import { isDebugEnabled } from './debug-state';
import type { LogFn, Logger, LogMethod } from './types';

/** Prefix prepended to every log line. */
const LOG_PREFIX = 'Amazon Wishlist Search';

const LOG_METHODS: readonly LogMethod[] = ['log', 'warn', 'error', 'debug'];

/** Typeguard: is `method` one of the console methods we support? */
const isLogMethod = (method: string): method is LogMethod =>
  (LOG_METHODS as readonly string[]).includes(method);

const applyPrefix = (prefix: string, args: unknown[]): unknown[] => {
  if (typeof args[0] === 'string') {
    return [`[${prefix}] ${args[0]}`, ...args.slice(1)];
  }
  return [prefix, ...args];
};

/**
 * Build a log function that prepends `[prefix]` to each call. A string first
 * argument is prefixed inline (so format specifiers still line up); otherwise
 * the prefix is unshifted as its own argument.
 *
 * The `debug` channel is opt-in via the runtime debug flag (see
 * `debug-state.ts`). When enabled it routes to `console.log` (not
 * `console.debug`) so messages are visible without turning on the browser
 * console's "Verbose" level.
 */
const createLogger = (logType: string = 'log', prefix: string = LOG_PREFIX): LogFn => {
  let method: LogMethod = 'log';
  if (isLogMethod(logType)) {
    method = logType;
  } else {
    console.warn(`[${LOG_PREFIX}] createLogger: console.${logType} is not a valid log type`);
  }

  if (method === 'debug') {
    return (...args: unknown[]): void => {
      if (!isDebugEnabled()) return;
      console.log(...applyPrefix(`${prefix} debug`, args));
    };
  }

  return (...args: unknown[]): void => {
    console[method](...applyPrefix(prefix, args));
  };
};

/** Prefixed logger used throughout the userscript. */
export const log: Logger = {
  log: createLogger('log'),
  warn: createLogger('warn'),
  error: createLogger('error'),
  debug: createLogger('debug'),
};
