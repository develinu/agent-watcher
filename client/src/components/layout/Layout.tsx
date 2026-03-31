import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.js";

interface LayoutProps {
  isConnected: boolean;
}

export function Layout({ isConnected }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100">
      <Sidebar isConnected={isConnected} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
