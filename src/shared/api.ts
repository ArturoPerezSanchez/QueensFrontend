/** Builds URLs against the current public API contract. */
export const API_V1_PREFIX = "/api/v1";

export function apiPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_V1_PREFIX}${normalizedPath}`;
}
