/** Join class names, dropping falsy entries. A dependency-free `clsx` subset. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}
