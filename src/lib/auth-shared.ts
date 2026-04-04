export const ADMIN_SESSION_COOKIE = "cougpulse_admin_session";
export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "password";
export const DEFAULT_ADMIN_SESSION_SECRET = "cougpulse-dev-session-secret";

export function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || DEFAULT_ADMIN_SESSION_SECRET;
}
