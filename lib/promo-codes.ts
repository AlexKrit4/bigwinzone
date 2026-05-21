export const ADMIN_GRANT_CODE_PREFIX = "ADM-";

export function isAdminGrantCode(code: string) {
  return code.toUpperCase().startsWith(ADMIN_GRANT_CODE_PREFIX);
}
