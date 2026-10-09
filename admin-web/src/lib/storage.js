const KEYS = {
  session: "petrise.session",
  companyId: "petrise.companyId",
  remember: "petrise.remember",
};

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isRememberedSession() {
  return localStorage.getItem(KEYS.remember) === "true";
}

export function getStoredSession() {
  const persistent = safeParse(localStorage.getItem(KEYS.session));
  if (persistent) return persistent;
  return safeParse(sessionStorage.getItem(KEYS.session));
}

export function setStoredSession(session, remember = isRememberedSession()) {
  if (remember) {
    localStorage.setItem(KEYS.remember, "true");
    localStorage.setItem(KEYS.session, JSON.stringify(session));
    sessionStorage.removeItem(KEYS.session);
  } else {
    localStorage.removeItem(KEYS.remember);
    localStorage.removeItem(KEYS.session);
    sessionStorage.setItem(KEYS.session, JSON.stringify(session));
  }
}

export function updateStoredSession(session) {
  setStoredSession(session, isRememberedSession());
}

export function clearStoredSession() {
  localStorage.removeItem(KEYS.session);
  localStorage.removeItem(KEYS.companyId);
  localStorage.removeItem(KEYS.remember);
  sessionStorage.removeItem(KEYS.session);
  sessionStorage.removeItem(KEYS.companyId);
}

export function getSelectedCompanyId() {
  return (
    (isRememberedSession() ? localStorage.getItem(KEYS.companyId) : null) ||
    sessionStorage.getItem(KEYS.companyId) ||
    localStorage.getItem(KEYS.companyId)
  );
}

export function setSelectedCompanyId(companyId) {
  const target = isRememberedSession() ? localStorage : sessionStorage;
  const other = isRememberedSession() ? sessionStorage : localStorage;

  if (companyId) {
    target.setItem(KEYS.companyId, companyId);
    other.removeItem(KEYS.companyId);
  } else {
    target.removeItem(KEYS.companyId);
    other.removeItem(KEYS.companyId);
  }
}
