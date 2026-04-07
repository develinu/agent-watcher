import React from "react";
import { Box, Text } from "ink";
import type { SessionSummary } from "@agent-watcher/shared";
import {
  formatRelativeTime,
  formatTokenCount,
  formatCost,
  resolveSessionTitle,
} from "../lib/format.js";

interface SessionListProps {
  readonly sessions: readonly SessionSummary[];
  readonly activeSessions: ReadonlySet<string>;
  readonly selectedIndex: number;
  readonly isFocused: boolean;
}

export function SessionList({
  sessions,
  activeSessions,
  selectedIndex,
  isFocused,
}: SessionListProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>No sessions found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {sessions.map((session, i) => {
        const isSelected = i === selectedIndex;
        const isActive = activeSessions.has(session.id);
        const title = resolveSessionTitle(session);
        const tokens = formatTokenCount(session.totalInputTokens + session.totalOutputTokens);
        const time = formatRelativeTime(session.lastActiveAt);
        const cost = formatCost(session.estimatedCost);

        return (
          <Box key={session.id} paddingX={1}>
            <Text
              color={isSelected && isFocused ? "cyan" : undefined}
              bold={isSelected}
              inverse={isSelected && isFocused}
            >
              {isActive ? <Text color="green"> ● </Text> : <Text dimColor> ○ </Text>}
              <Text>{title.length > 30 ? `${title.slice(0, 30)}..` : title}</Text>
              <Text dimColor>
                {" "}
                {time} {tokens} {cost}
              </Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
