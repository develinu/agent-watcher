import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import type { IncomingMessage } from "node:http";
import type { FileChangeEvent, FileWatcher } from "./file-watcher.js";
import type { WsEvent } from "@agent-watcher/shared";
import { getActiveSessions } from "../services/active-detector.js";
import { config } from "../config.js";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  `http://localhost:${config.serverPort}`,
  `http://127.0.0.1:${config.serverPort}`,
]);

export class WsBroadcaster {
  private wss: WebSocketServer;
  private activeInterval: ReturnType<typeof setInterval> | null = null;

  constructor(server: Server, fileWatcher: FileWatcher) {
    this.wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const origin = req.headers.origin;
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        ws.close(1008, "Origin not allowed");
        return;
      }

      ws.on("error", (err) => console.error("WebSocket client error:", err));

      // Send initial active sessions
      this.sendActiveSessions(ws);
    });

    fileWatcher.on("session-updated", (event: FileChangeEvent) => {
      this.onSessionUpdated(event);
    });

    // Periodically broadcast active sessions
    this.activeInterval = setInterval(() => {
      this.broadcastActiveSessions();
    }, 10_000);
  }

  stop(): void {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
    this.wss.close();
  }

  private onSessionUpdated(event: FileChangeEvent): void {
    const newAssistantMessages = event.records.filter((r) => r.type === "assistant");
    let inputDelta = 0;
    let outputDelta = 0;

    for (const record of newAssistantMessages) {
      if (record.type === "assistant" && record.message.usage) {
        inputDelta += record.message.usage.input_tokens;
        outputDelta += record.message.usage.output_tokens;
      }
    }

    const wsEvent: WsEvent = {
      type: "session:update",
      projectId: event.projectId,
      sessionId: event.sessionId,
      newMessages: event.records
        .filter((r) => r.type === "user" || r.type === "assistant")
        .map((r) => {
          if (r.type === "user") {
            return {
              uuid: r.uuid,
              type: "user" as const,
              timestamp: r.timestamp,
              content: r.message.content,
              isSidechain: r.isSidechain,
            };
          }
          const ar = r as Extract<typeof r, { type: "assistant" }>;
          return {
            uuid: ar.uuid,
            type: "assistant" as const,
            timestamp: ar.timestamp,
            content: ar.message.content,
            model: ar.message.model,
            usage: ar.message.usage,
            agentId: ar.agentId,
            isSidechain: ar.isSidechain,
          };
        }),
      tokenDelta: { input: inputDelta, output: outputDelta },
    };

    this.broadcast(wsEvent);
  }

  private async broadcastActiveSessions(): Promise<void> {
    try {
      const active = await getActiveSessions();
      const wsEvent: WsEvent = {
        type: "session:active",
        activeSessions: active.map((a) => ({
          sessionId: a.sessionId,
          projectId: a.projectId,
        })),
      };
      this.broadcast(wsEvent);
    } catch {
      // Ignore errors in periodic broadcast
    }
  }

  private async sendActiveSessions(ws: WebSocket): Promise<void> {
    try {
      const active = await getActiveSessions();
      const wsEvent: WsEvent = {
        type: "session:active",
        activeSessions: active.map((a) => ({
          sessionId: a.sessionId,
          projectId: a.projectId,
        })),
      };
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(wsEvent));
      }
    } catch {
      // Ignore
    }
  }

  private broadcast(event: WsEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(data);
      }
    }
  }
}
