import { X } from "lucide-react";

export default function Modal({ open, title, subtitle, children, onClose, footer, size = "md" }) {
  if (!open) return null;

  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section className={`modal-card modal-card--${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-card__header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={19} />
          </button>
        </header>

        <div className="modal-card__body">{children}</div>

        {footer ? <footer className="modal-card__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
