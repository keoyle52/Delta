type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true';

export const logger = {
  debug: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    console.log('[INFO]', ...args);
  },
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
};
