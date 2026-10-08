import { PawPrint } from "lucide-react";

export default function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark ${compact ? "brand-mark--compact" : ""}`}>
      <span className="brand-mark__icon" aria-hidden="true">
        <PawPrint size={compact ? 18 : 22} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="brand-mark__text">
          Bich<span>One</span>
        </span>
      )}
    </div>
  );
}
