import { NavLink } from "react-router-dom";
import { clsx } from "clsx";
import { StatusIndicator } from "../common/StatusIndicator.js";

interface SidebarProps {
  isConnected: boolean;
}

export function Sidebar({ isConnected }: SidebarProps) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
      isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
    );

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-800 bg-gray-950 p-4">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
          AW
        </div>
        <span className="text-sm font-semibold text-white">Agent Watcher</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <NavLink to="/" end className={linkClass}>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Dashboard
        </NavLink>
        <NavLink to="/analytics" className={linkClass}>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Analytics
        </NavLink>
      </nav>

      <div className="flex items-center gap-2 border-t border-gray-800 pt-3 text-xs text-gray-500">
        <StatusIndicator active={isConnected} />
        {isConnected ? "Connected" : "Disconnected"}
      </div>
    </aside>
  );
}
