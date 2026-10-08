export default function InlineNotice({ tone = "info", children }) {
  if (!children) return null;
  return <div className={`inline-notice inline-notice--${tone}`}>{children}</div>;
}
