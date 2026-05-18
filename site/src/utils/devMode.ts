/**
 * Development-only gate for tooling that must never run or ship in production.
 * Uses NODE_ENV only (no query params, localStorage, or URL flags).
 */
export const isDevMode = (): boolean => process.env.NODE_ENV === 'development';
