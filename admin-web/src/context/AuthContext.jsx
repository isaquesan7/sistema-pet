import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../lib/api.js";
import {
  clearStoredSession,
  getSelectedCompanyId,
  getStoredSession,
  setSelectedCompanyId,
  setStoredSession,
} from "../lib/storage.js";

const AuthContext = createContext(null);

function findCompany(session, companyId) {
  return session?.usuario?.empresas?.find((company) => company.id === companyId) || null;
}

function findOrganization(session, company) {
  if (!company) return null;
  return (
    session?.usuario?.organizacoes?.find(
      (organization) => organization.id === company.organizacaoId
    ) || null
  );
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getStoredSession());
  const [companyId, setCompanyId] = useState(() => getSelectedCompanyId());

  const clearLocalSession = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setCompanyId(null);
  }, []);

  const logout = useCallback(async () => {
    const current = getStoredSession();
    clearLocalSession();

    if (current?.refreshToken) {
      try {
        await api.post("/auth/logout", { refreshToken: current.refreshToken });
      } catch {
        // A interface já saiu; a revogação remota é best effort quando a API está indisponível.
      }
    }
  }, [clearLocalSession]);

  useEffect(() => {
    const handleUnauthorized = () => clearLocalSession();
    const handleRefresh = (event) => setSession(event.detail || getStoredSession());
    window.addEventListener("bichone:unauthorized", handleUnauthorized);
    window.addEventListener("bichone:session-refreshed", handleRefresh);
    return () => {
      window.removeEventListener("bichone:unauthorized", handleUnauthorized);
      window.removeEventListener("bichone:session-refreshed", handleRefresh);
    };
  }, [clearLocalSession]);

  useEffect(() => {
    if (!session) return;
    const selected = findCompany(session, companyId);
    if (!selected && companyId) {
      setSelectedCompanyId(null);
      setCompanyId(null);
    }
  }, [session, companyId]);

  const login = useCallback(async ({ email, senha, manterConectado = false }) => {
    const { data } = await api.post("/auth/login", { email, senha, manterConectado });
    const nextSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      manterConectado: Boolean(data.manterConectado),
      usuario: data.usuario,
    };

    setStoredSession(nextSession, Boolean(data.manterConectado));
    setSession(nextSession);

    const companies = data.usuario?.empresas || [];
    if (companies.length === 1) {
      setSelectedCompanyId(companies[0].id);
      setCompanyId(companies[0].id);
      return { session: nextSession, companyId: companies[0].id };
    }

    setSelectedCompanyId(null);
    setCompanyId(null);
    return { session: nextSession, companyId: null };
  }, []);

  const selectCompany = useCallback((id) => {
    setSelectedCompanyId(id);
    setCompanyId(id);
  }, []);

  const updateOrganizationConfig = useCallback((organizationId, configuracao) => {
    setSession((current) => {
      if (!current?.usuario) return current;
      const next = {
        ...current,
        usuario: {
          ...current.usuario,
          organizacoes: (current.usuario.organizacoes || []).map((organization) =>
            organization.id === organizationId
              ? { ...organization, configuracao: { ...(organization.configuracao || {}), ...configuracao } }
              : organization
          ),
        },
      };
      setStoredSession(next, Boolean(next.manterConectado));
      return next;
    });
  }, []);

  const updateOrganizationModules = useCallback((organizationId, modules) => {
    setSession((current) => {
      if (!current?.usuario) return current;
      const next = {
        ...current,
        usuario: {
          ...current.usuario,
          organizacoes: (current.usuario.organizacoes || []).map((organization) =>
            organization.id === organizationId
              ? { ...organization, modulos: [...modules] }
              : organization
          ),
        },
      };
      setStoredSession(next, Boolean(next.manterConectado));
      return next;
    });
  }, []);

  const selectedCompany = useMemo(
    () => findCompany(session, companyId),
    [session, companyId]
  );

  const selectedOrganization = useMemo(
    () => findOrganization(session, selectedCompany),
    [session, selectedCompany]
  );

  const hasPermission = useCallback(
    (permission) => {
      if (!permission) return true;
      return selectedCompany?.permissoes?.includes(permission) ?? false;
    },
    [selectedCompany]
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.usuario || null,
      isAuthenticated: Boolean(session?.accessToken),
      selectedCompany,
      selectedOrganization,
      login,
      logout,
      selectCompany,
      updateOrganizationConfig,
      updateOrganizationModules,
      hasPermission,
    }),
    [
      session,
      selectedCompany,
      selectedOrganization,
      login,
      logout,
      selectCompany,
      updateOrganizationConfig,
      updateOrganizationModules,
      hasPermission,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
