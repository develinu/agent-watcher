import { Router } from "express";
import { getSession } from "../services/session-service.js";
import { getSessionTokenTimeline } from "../services/analytics-service.js";
import { getProjectIndex } from "../services/project-service.js";
import { parseJsonlFile } from "../services/jsonl-parser.js";
import { analyzeSession, isAnalysisAvailable } from "../services/llm-analyzer.js";

export const sessionsRouter = Router();

sessionsRouter.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { projectId } = req.query;

    if (!projectId || typeof projectId !== "string") {
      res.status(400).json({ error: "projectId query parameter is required" });
      return;
    }

    const index = await getProjectIndex();
    const project = index.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const sessionMeta = project.sessions.get(sessionId);
    if (!sessionMeta) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const session = await getSession(
      projectId,
      sessionId,
      sessionMeta.filePath,
      sessionMeta.subagentDir
    );
    res.json(session);
  } catch (err) {
    console.error("Failed to get session:", err);
    res.status(500).json({ error: "Failed to get session" });
  }
});

sessionsRouter.get("/:sessionId/timeline", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { projectId } = req.query;

    if (!projectId || typeof projectId !== "string") {
      res.status(400).json({ error: "projectId query parameter is required" });
      return;
    }

    const index = await getProjectIndex();
    const project = index.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const sessionMeta = project.sessions.get(sessionId);
    if (!sessionMeta) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const timeline = await getSessionTokenTimeline(sessionMeta.filePath, sessionId);
    res.json(timeline);
  } catch (err) {
    console.error("Failed to get session timeline:", err);
    res.status(500).json({ error: "Failed to get session timeline" });
  }
});

sessionsRouter.get("/:sessionId/analyze", async (req, res) => {
  try {
    if (!isAnalysisAvailable()) {
      res.status(503).json({ error: "Analysis provider API key not configured" });
      return;
    }

    const { sessionId } = req.params;
    const { projectId } = req.query;

    if (!projectId || typeof projectId !== "string") {
      res.status(400).json({ error: "projectId query parameter is required" });
      return;
    }

    const index = await getProjectIndex();
    const project = index.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const sessionMeta = project.sessions.get(sessionId);
    if (!sessionMeta) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const records = await parseJsonlFile(sessionMeta.filePath);
    const analysis = await analyzeSession(sessionId, records);
    res.json(analysis);
  } catch (err) {
    console.error("Failed to analyze session:", err);
    res.status(500).json({ error: "Failed to analyze session" });
  }
});
