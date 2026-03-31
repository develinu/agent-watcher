import { clsx } from "clsx";

interface StatusIndicatorProps {
  active: boolean;
  size?: "sm" | "md";
}

export function StatusIndicator({ active, size = "sm" }: StatusIndicatorProps) {
  return (
    <span className="relative inline-flex">
      <span
        className={clsx(
          "rounded-full",
          size === "sm" ? "h-2 w-2" : "h-3 w-3",
          active ? "bg-emerald-400" : "bg-gray-500"
        )}
      />
      {active && (
        <span
          className={clsx(
            "absolute inline-flex rounded-full opacity-75 animate-ping",
            size === "sm" ? "h-2 w-2" : "h-3 w-3",
            "bg-emerald-400"
          )}
        />
      )}
    </span>
  );
}
