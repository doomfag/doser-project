export const WEEK = 7 * 24 * 60 * 60 * 1000;
export const RETRY_DELAY = 60 * 60 * 1000;
export interface UpdatePreferences {
  automatic: boolean;
  lastAttempt?: string;
}
export function shouldCheck(
  preferences: UpdatePreferences,
  lastSuccess?: string,
  now = Date.now(),
): boolean {
  if (!preferences.automatic) return false;
  const attempt = Date.parse(preferences.lastAttempt || "");
  if (Number.isFinite(attempt) && attempt <= now && now - attempt < RETRY_DELAY)
    return false;
  const success = Date.parse(lastSuccess || "");
  return !Number.isFinite(success) || success > now || now - success >= WEEK;
}
