import { Router } from "express";
import { getProjects, getProject } from "../services/project-service.js";

export const projectsRouter = Router();

projectsRouter.get("/", async (_req, res) => {
  try {
    const projects = await getProjects();
    res.json(projects);
  } catch (err) {
    console.error("Failed to list projects:", err);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

projectsRouter.get("/:projectId", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  } catch (err) {
    console.error("Failed to get project:", err);
    res.status(500).json({ error: "Failed to get project" });
  }
});
