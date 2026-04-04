import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  readonly isConnected: boolean;
  readonly projectName: string;
  readonly activeCount: number;
  readonly focusPanel: "sessions" | "workflow";
}

export function StatusBar({
  isConnected,
  projectName,
  activeCount,
  focusPanel,
}: StatusBarProps): React.ReactElement {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        {isConnected ? (
          <Text color="green">● Connected</Text>
        ) : (
          <Text color="red">● Disconnected</Text>
        )}
        <Text>
          <Text dimColor>Project:</Text> {projectName}
        </Text>
        {activeCount > 0 && <Text color="green">{activeCount} active</Text>}
      </Box>

      <Box gap={2}>
        <Text dimColor>
          Tab:<Text color={focusPanel === "sessions" ? "cyan" : "gray"}>sessions</Text>/
          <Text color={focusPanel === "workflow" ? "cyan" : "gray"}>workflow</Text>
        </Text>
        <Text dimColor>↑↓:navigate Enter:select q:quit</Text>
      </Box>
    </Box>
  );
}
