import React from "react";
import { Box, Text } from "ink";
import type { Phase } from "../lib/tree-layout.js";
import { getPhaseStyle } from "../lib/phase-styles.js";
import { formatTokenCount, formatDuration } from "../lib/format.js";

interface PhaseDetailProps {
  readonly phase: Phase | null;
}

export function PhaseDetail({ phase }: PhaseDetailProps): React.ReactElement {
  if (!phase) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
        <Text dimColor>Select a phase to view details</Text>
      </Box>
    );
  }

  const style = getPhaseStyle(phase.phaseType);
  const tokens = formatTokenCount(phase.totalInputTokens + phase.totalOutputTokens);
  const duration = formatDuration(phase.startTime, phase.endTime);
  const toolEntries = Object.entries(phase.toolSummary).sort(([, a], [, b]) => b - a);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column" flexShrink={0}>
      {/* Header */}
      <Box>
        <Text color={style.color} bold>
          [{style.label}]
        </Text>
        <Text bold> {phase.title}</Text>
      </Box>

      {/* Summary */}
      <Box marginTop={1}>
        <Text wrap="wrap">{phase.summary}</Text>
      </Box>

      {/* Stats */}
      <Box marginTop={1} gap={2}>
        <Text>
          <Text dimColor>Turns:</Text> {phase.turns.length}
        </Text>
        <Text>
          <Text dimColor>Tokens:</Text> {tokens}
        </Text>
        <Text>
          <Text dimColor>Duration:</Text> {duration}
        </Text>
      </Box>

      {/* Tools */}
      {toolEntries.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor underline>
            Tools
          </Text>
          <Box flexWrap="wrap" gap={1}>
            {toolEntries.map(([name, count]) => (
              <Text key={name}>
                <Text color="yellow">{name}</Text>
                <Text dimColor>({count})</Text>
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Files */}
      {phase.filesChanged.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor underline>
            Files
          </Text>
          {phase.filesChanged.slice(0, 8).map((f) => (
            <Text key={f} color="blue">
              {f}
            </Text>
          ))}
          {phase.filesChanged.length > 8 && (
            <Text dimColor>+{phase.filesChanged.length - 8} more</Text>
          )}
        </Box>
      )}

      {/* Subagents */}
      {phase.subagentIds.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>Agents:</Text>
          <Text> {phase.subagentIds.length}</Text>
        </Box>
      )}
    </Box>
  );
}
