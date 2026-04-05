import { useState, useEffect, useRef, useCallback } from "react";
import WebSocket from "ws";
import type { WsEvent } from "@agent-watcher/shared";

interface UseWsResult {
  readonly isConnected: boolean;
  readonly subscribe: (handler: (event: WsEvent) => void) => () => void;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export function useWs(host: string, port: number): UseWsResult {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<(event: WsEvent) => void>>(new Set());
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(`ws://${host}:${port}/ws`);
      wsRef.current = ws;

      ws.on("open", () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        retryCountRef.current = 0;
      });

      ws.on("message", (raw: WebSocket.RawData) => {
        try {
          const event = JSON.parse(raw.toString()) as WsEvent;
          for (const handler of handlersRef.current) {
            handler(event);
          }
        } catch {
          // ignore malformed messages
        }
      });

      ws.on("close", () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        scheduleReconnect();
      });

      ws.on("error", (err: Error) => {
        if (!mountedRef.current) return;
        // close event will fire after error, triggering reconnect
        // Suppress ECONNREFUSED noise — reconnect handles it
        if ("code" in err && (err as NodeJS.ErrnoException).code === "ECONNREFUSED") return;
      });
    }

    function scheduleReconnect() {
      if (!mountedRef.current) return;
      const backoff = Math.min(
        BASE_BACKOFF_MS * Math.pow(2, retryCountRef.current),
        MAX_BACKOFF_MS
      );
      const jitter = backoff * (0.5 + Math.random() * 0.5);
      retryCountRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, jitter);
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [host, port]);

  const subscribe = useCallback((handler: (event: WsEvent) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return { isConnected, subscribe };
}
