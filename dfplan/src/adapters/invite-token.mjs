/** URL parsing is isolated here; never log, persist or copy the invitation token. */
export function consumeInviteToken(location, history) {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token = fragment.get("invite") || "";
  if (fragment.has("invite"))
    history.replaceState(null, "", location.pathname + location.search);
  return {
    token: /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "",
    invalid: fragment.has("invite") && !/^[A-Za-z0-9_-]{43}$/.test(token),
  };
}
