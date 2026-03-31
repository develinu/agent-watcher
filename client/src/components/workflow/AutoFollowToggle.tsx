interface AutoFollowToggleProps {
  readonly enabled: boolean;
  readonly onToggle: (v: boolean) => void;
}

export function AutoFollowToggle({ enabled, onToggle }: AutoFollowToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      className={`absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors ${
        enabled
          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
          : "bg-gray-800/90 text-gray-500 hover:bg-gray-700/90"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-3.5 w-3.5"
      >
        {enabled ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.98 8.223A10.477 10.477 0 0 0 2.458 12C3.732 16.057 7.523 19 12 19c1.74 0 3.373-.457 4.782-1.259M6.228 6.228A10.451 10.451 0 0 1 12 5c4.478 0 8.268 2.943 9.542 7a10.477 10.477 0 0 1-2.78 4.228M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
          />
        )}
      </svg>
      Auto-follow
    </button>
  );
}
