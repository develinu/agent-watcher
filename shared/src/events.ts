import type { ParsedMessage, SessionSummary } from "./analytics.js";

export interface SessionUpdateEvent {
  readonly type: "session:update";
  readonly projectId: string;
  readonly sessionId: string;
  readonly newMessages: readonly ParsedMessage[];
  readonly tokenDelta: {
    readonly input: number;
    readonly output: number;
  };
}

export interface SessionNewEvent {
  readonly type: "session:new";
  readonly projectId: string;
  readonly session: SessionSummary;
}

export interface ActiveSessionsEvent {
  readonly type: "session:active";
  readonly activeSessions: readonly {
    readonly sessionId: string;
    readonly projectId: string;
  }[];
}

export interface AnalyticsUpdateEvent {
  readonly type: "analytics:update";
  readonly tokenDelta: {
    readonly input: number;
    readonly output: number;
  };
}

export type WsEvent =
  | SessionUpdateEvent
  | SessionNewEvent
  | ActiveSessionsEvent
  | AnalyticsUpdateEvent;
