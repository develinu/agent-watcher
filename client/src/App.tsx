import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { ProjectPage } from "./pages/ProjectPage.js";
import { SessionPage } from "./pages/SessionPage.js";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { WebSocketContext } from "./hooks/useWsContext.js";

export function App() {
  const ws = useWebSocket();

  return (
    <WebSocketContext.Provider value={ws}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout isConnected={ws.isConnected} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/sessions/:sessionId" element={<SessionPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WebSocketContext.Provider>
  );
}
