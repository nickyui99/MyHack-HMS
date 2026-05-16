/**
 * Single place to read Vite env variables and provide sensible defaults.
 *
 * VITE_API_BASE_URL        — Node Express matching API origin.
 *                            Leave empty/unset to force mock mode.
 * VITE_DEMO_MODE           — '1' to force the mock-data path regardless of API.
 * VITE_ADK_BASE_URL        — ADK Python chat server origin. Defaults to '/adk',
 *                            which the Vite dev server proxies to http://localhost:8100
 *                            (see vite.config.ts). In prod, set this to the deployed
 *                            ADK origin or to another same-origin path.
 *                            Set to '' to disable the in-app chatbot.
 * VITE_ADK_PERSONA_USER_ID — Hardcoded persona for the chat session.
 * VITE_ADK_APP_NAME        — ADK `app_name` segment under /apps/{app_name}/users/...
 */

const env = import.meta.env;

export const API_BASE_URL: string = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export const FORCED_DEMO: boolean = env.VITE_DEMO_MODE === '1';
export const HAS_API: boolean = Boolean(API_BASE_URL) && !FORCED_DEMO;

// Sent as x-carelink-local-user so the backend currentUser() middleware can
// stamp audit logs and authorize mutations. Staging Cloud Run is
// --allow-unauthenticated (no IAP), so this header is the only "who's calling".
export const LOCAL_USER_EMAIL: string = env.VITE_LOCAL_USER_EMAIL ?? '';

// Seeded GP actor id in the backend's demo dataset — used as `actor_a` (the
// requesting clinician) on relationships and match calls. Mirrors the value
// already hardcoded in src/lib/api.ts for match calls.
export const REQUESTER_ACTOR_ID: string =
  env.VITE_REQUESTER_ACTOR_ID ?? '00000000-0000-4000-8000-000000000001';

export const ADK_BASE_URL: string =
  (env.VITE_ADK_BASE_URL ?? '/adk').replace(/\/$/, '');
export const ADK_PERSONA_USER_ID: string =
  env.VITE_ADK_PERSONA_USER_ID ?? 'gp.amirul@carelink.demo';
export const ADK_APP_NAME: string = env.VITE_ADK_APP_NAME ?? 'carelink';
export const HAS_CHAT: boolean = ADK_BASE_URL.length > 0;
