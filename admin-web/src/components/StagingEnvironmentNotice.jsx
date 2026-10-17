import { AlertTriangle } from "lucide-react";
import { POINTVET_IS_STAGING } from "../lib/stagingEnvironment.js";
import "./staging-environment-notice.css";

/** Visible to humans on both the login page and the authenticated dashboard. */
export default function StagingEnvironmentNotice() {
  if (!POINTVET_IS_STAGING) return null;
  return (
    <div className="pv-stage-notice" role="status" aria-label="Ambiente de homologação">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>
        <strong>HOMOLOGAÇÃO — dados de teste.</strong> Este não é o ambiente comercial da Pet King.
        Não registre clientes, cobranças ou pagamentos reais. Não há emissão fiscal nesta etapa.
      </span>
    </div>
  );
}
