/**
 * Single place to read Vite env variables and provide sensible defaults.
 *
 * VITE_API_BASE_URL — backend origin. Leave empty/unset to force mock mode.
 *                     Example: http://localhost:8000
 * VITE_DEMO_MODE    — '1' to force the mock-data path regardless of API.
 */

const env = import.meta.env;

export const API_BASE_URL: string = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export const FORCED_DEMO: boolean = env.VITE_DEMO_MODE === '1';
export const HAS_API: boolean = Boolean(API_BASE_URL) && !FORCED_DEMO;
