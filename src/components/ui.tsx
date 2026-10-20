import { ArrowUpRight, ChevronRight } from "lucide-react";
import { safeUrl } from "../domain/catalog";
export function External({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return safeUrl(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={15} />
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  ) : (
    <span>Link indisponível</span>
  );
}
export function PageHeading({
  index,
  title,
  subtitle,
}: {
  index: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">DOSER / {index}</p>
        <h1>{title}</h1>
        <p className="subheading">{subtitle}</p>
      </div>
    </div>
  );
}
export function Empty({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
