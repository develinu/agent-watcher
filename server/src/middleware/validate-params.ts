import type { Request, Response, NextFunction } from "express";

const SAFE_ID = /^[a-zA-Z0-9_\-.]+$/;

function isSafeId(value: unknown): boolean {
  return typeof value === "string" && SAFE_ID.test(value);
}

export function validateProjectId(req: Request, res: Response, next: NextFunction): void {
  const paramId = req.params.projectId;
  if (paramId !== undefined && !isSafeId(paramId)) {
    res.status(400).json({ error: "Invalid projectId" });
    return;
  }

  const queryId = req.query.projectId;
  if (queryId !== undefined && !isSafeId(queryId)) {
    res.status(400).json({ error: "Invalid projectId" });
    return;
  }

  next();
}

export function validateSessionId(req: Request, res: Response, next: NextFunction): void {
  const paramId = req.params.sessionId;
  if (paramId !== undefined && !isSafeId(paramId)) {
    res.status(400).json({ error: "Invalid sessionId" });
    return;
  }
  next();
}
