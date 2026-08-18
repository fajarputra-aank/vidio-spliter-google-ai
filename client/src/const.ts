export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Navigate to the application-owned email-and-password sign-in screen. */
export const startLogin = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/masuk?next=${encodeURIComponent(next)}`);
};
