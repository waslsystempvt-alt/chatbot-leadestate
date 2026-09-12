import { PRIMARY_ACTION_OPTIONS, CONFIGURATION_OPTIONS } from "../lib/constants";

export type OptionsVariant = "cta-grid" | "config-grid" | "inline-options" | null;

interface OptionsPanelProps {
  variant: OptionsVariant;
  dismissing: boolean;
  onSelect: (option: string) => void;
}

export function OptionsPanel({ variant, dismissing, onSelect }: OptionsPanelProps) {
  if (!variant) return null;

  const list =
    variant === "cta-grid"
      ? [...PRIMARY_ACTION_OPTIONS]
      : variant === "config-grid"
        ? [...CONFIGURATION_OPTIONS]
        : [];

  const className = [
    "options",
    variant === "cta-grid" ? "cta-grid" : "inline-options",
    variant === "config-grid" ? "config-grid" : "",
    dismissing ? "is-dismissing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {list.map((opt, idx) => {
        const delay = variant === "cta-grid" ? 300 + idx * 150 : 140 + idx * 90;
        if (variant === "cta-grid") {
          return (
            <button
              key={opt}
              type="button"
              className="cta-button"
              style={{ animationDelay: `${delay}ms` }}
              onClick={() => onSelect(opt)}
            >
              {opt}
            </button>
          );
        }
        return (
          <button
            key={opt}
            type="button"
            className="btn"
            style={{ animationDelay: `${delay}ms` }}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
