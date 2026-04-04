import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { projectsRouter } from "./routes/projects.js";
import { sessionsRouter } from "./routes/sessions.js";
import { analyticsRouter } from "./routes/analytics.js";
import { FileWatcher } from "./watchers/file-watcher.js";
import { WsBroadcaster } from "./watchers/ws-broadcaster.js";
import { refreshProjectIndex } from "./services/project-service.js";
import { validateProjectId, validateSessionId } from "./middleware/validate-params.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

const app = express();

// Security: restrict CORS to known origins
app.use(
  cors({
    origin: isProduction
      ? false
      : ["http://localhost:9999", `http://localhost:${config.serverPort}`],
  })
);
app.use(helmet({ contentSecurityPolicy: isProduction }));
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const analysisLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// API routes
app.use("/api/projects", apiLimiter, validateProjectId, projectsRouter);
app.use("/api/sessions", apiLimiter, validateSessionId, validateProjectId, sessionsRouter);
app.use("/api/sessions/:sessionId/analyze", analysisLimiter);
app.use("/api/analytics", apiLimiter, analyticsRouter);

app.get("/api/status", (_req, res) => {
  res.json({ status: "ok" });
});

// Production: serve client static files + SPA fallback
const clientDist = join(__dirname, "../../client/dist");
if (isProduction && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

const server = createServer(app);

const fileWatcher = new FileWatcher(config.claudeDir);
const wsBroadcaster = new WsBroadcaster(server, fileWatcher);

async function start(): Promise<void> {
  console.log(`Scanning ${config.claudeDir}...`);
  await refreshProjectIndex();
  console.log("Project index built.");

  fileWatcher.start();
  console.log("File watcher started.");

  const host = isProduction ? "127.0.0.1" : "0.0.0.0";
  server.listen(config.serverPort, host, () => {
    console.log(`Agent Watcher server running on http://${host}:${config.serverPort}`);
    console.log(`WebSocket available at ws://${host}:${config.serverPort}/ws`);
  });
}

function shutdown(): void {
  console.log("\nShutting down...");
  fileWatcher.stop();
  wsBroadcaster.stop();
  server.close(() => {
    process.exit(0);
  });
  // Force exit after 5s if connections don't drain
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
