export default function FormField({ label, hint, error, className = "", children }) {
  return (
    <label className={`form-field ${className}`}>
      <span className="form-field__label">{label}</span>
      {children}
      {error ? <small className="form-field__error">{error}</small> : hint ? <small className="form-field__hint">{hint}</small> : null}
    </label>
  );
}
