import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage } from "../lib/api.js";

export default function LoginPage() {
  const { isAuthenticated, isPlatformAdmin, selectedCompany, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [manterConectado, setManterConectado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) {
    return <Navigate to={selectedCompany ? "/" : isPlatformAdmin ? "/plataforma" : "/selecionar-empresa"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login({ email, senha, manterConectado });
      const fallback = result.companyId ? "/" : result.session?.usuario?.superAdmin ? "/plataforma" : "/selecionar-empresa";
      navigate(location.state?.from || fallback, { replace: true });
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, "E-mail ou senha inválidos."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-visual__content">
          <BrandMark />
          <div className="auth-visual__copy">
            <span className="eyebrow-pill">Gestão pet em um só lugar</span>
            <h1>Mais organização para quem cuida de verdade.</h1>
            <p>
              PDV, clínica veterinária, banho e tosa, clientes, estoque e equipe em uma única plataforma.
            </p>
          </div>
          <div className="auth-visual__footer">PetRise · Plataforma de gestão pet</div>
        </div>
      </section>

      <section className="auth-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card__mobile-brand"><BrandMark /></div>
          <div className="login-card__heading">
            <span>Bem-vindo de volta</span>
            <h2>Entre na sua conta</h2>
            <p>Use seu acesso administrativo para continuar.</p>
          </div>

          {error && <div className="alert alert--error">{error}</div>}

          <label className="field">
            <span>E-mail</span>
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com.br"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="field">
            <span>Senha</span>
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="remember-login">
            <input
              type="checkbox"
              checked={manterConectado}
              onChange={(event) => setManterConectado(event.target.checked)}
            />
            <span>
              <strong>Mantenha-me conectado</strong>
              <small>Este dispositivo continuará conectado até você clicar em Sair.</small>
            </span>
          </label>

          <button className="primary-button primary-button--large" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar no PetRise"}
          </button>

          <p className="login-card__signup">Ainda não usa o PetRise? <Link to="/comecar">Criar conta e testar grátis</Link></p>
          <p className="login-card__security">Seu acesso e permissões são validados pela sua organização.</p>
        </form>
      </section>
    </div>
  );
}
