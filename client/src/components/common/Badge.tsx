import { clsx } from "clsx";

type Variant = "default" | "blue" | "green" | "yellow" | "purple" | "red";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-gray-700 text-gray-300",
  blue: "bg-blue-900/50 text-blue-300",
  green: "bg-emerald-900/50 text-emerald-300",
  yellow: "bg-yellow-900/50 text-yellow-300",
  purple: "bg-purple-900/50 text-purple-300",
  red: "bg-red-900/50 text-red-300",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variantClasses[variant]
      )}
    >
      {children}
    </span>
  );
}
