import { Construction } from "lucide-react";

export default function ComingSoonPage({ title }) {
  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="page-kicker">PetRise</span><h1>{title}</h1><p>A fundação deste módulo já está prevista. A interface será implementada nas próximas etapas.</p></div></section>
      <div className="empty-state empty-state--panel"><Construction size={36} /><strong>Módulo em construção</strong><p>Seguiremos a mesma identidade visual e regras de permissão do restante da plataforma.</p></div>
    </div>
  );
}
