const PREFIX = "petrise-client:";

export function saveSession(data, remember) {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(`${PREFIX}session`);
  target.setItem(`${PREFIX}session`, JSON.stringify({ ...data, remember }));
}

export function loadSession() {
  for (const store of [localStorage, sessionStorage]) {
    const raw = store.getItem(`${PREFIX}session`);
    if (raw) {
      try { return JSON.parse(raw); } catch { store.removeItem(`${PREFIX}session`); }
    }
  }
  return null;
}

export function clearSession() {
  localStorage.removeItem(`${PREFIX}session`);
  sessionStorage.removeItem(`${PREFIX}session`);
}
