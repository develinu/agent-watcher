import { createContext, useContext } from "react";
import type { WsEvent } from "@agent-watcher/shared";

interface WsContextValue {
  isConnected: boolean;
  subscribe: (handler: (event: WsEvent) => void) => () => void;
}

export const WebSocketContext = createContext<WsContextValue>({
  isConnected: false,
  subscribe: () => () => {},
});

export function useWs() {
  return useContext(WebSocketContext);
}
