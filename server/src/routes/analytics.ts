import { Router } from "express";
import { getTokenAnalytics } from "../services/analytics-service.js";
import { getActiveSessions } from "../services/active-detector.js";

export const analyticsRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!ISO_DATE.test(value) || isNaN(Date.parse(value))) return undefined;
  return value;
}

analyticsRouter.get("/tokens", async (req, res) => {
  try {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const analytics = await getTokenAnalytics(from, to);
    res.json(analytics);
  } catch (err) {
    console.error("Failed to get token analytics:", err);
    res.status(500).json({ error: "Failed to get token analytics" });
  }
});

analyticsRouter.get("/active", async (_req, res) => {
  try {
    const active = await getActiveSessions();
    res.json(active);
  } catch (err) {
    console.error("Failed to get active sessions:", err);
    res.status(500).json({ error: "Failed to get active sessions" });
  }
});
