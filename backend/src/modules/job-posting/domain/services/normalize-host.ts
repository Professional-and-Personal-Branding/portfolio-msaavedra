/** Host en minúsculas y sin punto final (`Example.COM.` → `example.com`). */
export function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, '');
}
