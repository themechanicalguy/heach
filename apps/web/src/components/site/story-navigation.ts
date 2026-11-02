/** Router stand-in for isolated Storybook rendering. No patient intent is persisted. */
export function usePathname() {
  return '/en';
}
export function useSearchParams() {
  return new URLSearchParams();
}
export function useRouter() {
  return { push: () => undefined, replace: () => undefined, refresh: () => undefined };
}
