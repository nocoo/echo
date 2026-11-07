export function isPublicOrigin(
  requestOrigin: string | null | undefined,
  publicOrigin: string,
): boolean {
  if (!publicOrigin) return false;
  if (!requestOrigin) return false;
  return requestOrigin === publicOrigin;
}
