import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { clearSession, loadSession, saveSession } from "../lib/storage.js";

const Context = createContext(null);
const slug = import.meta.env.VITE_ORGANIZACAO_SLUG || "pet-king";

export function ClientAuthProvider({ children }) {
  const initial = loadSession();
  const [session, setSession] = useState(initial);
  const [organization, setOrganization] = useState(initial?.conta?.organizacao || null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    api.get(`/portal/public/${slug}`)
      .then(({ data }) => {
        setOrganization(data.organizacao);
        const cfg = data.organizacao?.configuracao || {};
        document.documentElement.style.setProperty("--brand", cfg.corPrimaria || "#635bdb");
        document.documentElement.style.setProperty("--brand-2", cfg.corSecundaria || "#866cff");
      })
      .finally(() => setLoadingConfig(false));
  }, []);

  async function login(loginValue, password, remember = true) {
    const { data } = await api.post("/portal/auth/login", { organizacaoSlug: slug, login: loginValue, senha: password, manterConectado: remember });
    const next = { accessToken: data.accessToken, refreshToken: data.refreshToken, conta: data.conta };
    saveSession(next, data.manterConectado);
    setSession({ ...next, remember: data.manterConectado });
    setOrganization(data.conta.organizacao);
    return data;
  }

  async function register(payload) {
    const { data } = await api.post("/portal/auth/cadastro", { ...payload, organizacaoSlug: slug });
    const next = { accessToken: data.accessToken, refreshToken: data.refreshToken, conta: data.conta };
    saveSession(next, data.manterConectado);
    setSession({ ...next, remember: data.manterConectado });
    setOrganization(data.conta.organizacao);
    return data;
  }

  async function logout() {
    try { if (session?.refreshToken) await api.post("/portal/auth/logout", { refreshToken: session.refreshToken }); } catch {}
    clearSession();
    setSession(null);
  }

  function updateAccount(conta) {
    const next = { ...session, conta };
    saveSession(next, session?.remember ?? true);
    setSession(next);
  }

  const value = useMemo(() => ({ session, account: session?.conta, organization, loadingConfig, login, register, logout, updateAccount, slug }), [session, organization, loadingConfig]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useClientAuth() { return useContext(Context); }
