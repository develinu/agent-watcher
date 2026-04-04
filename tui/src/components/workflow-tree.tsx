import React from "react";
import { Box, Text } from "ink";
import type { Phase } from "../lib/tree-layout.js";
import { getPhaseStyle } from "../lib/phase-styles.js";
import { formatTokenCount, formatDuration } from "../lib/format.js";

interface WorkflowTreeProps {
  readonly phases: readonly Phase[];
  readonly selectedIndex: number;
  readonly isFocused: boolean;
}

function renderConnector(
  phaseIndex: number,
  totalPhases: number,
  isSelected: boolean
): React.ReactElement {
  if (phaseIndex === 0 && totalPhases === 1) {
    return <Text color={isSelected ? "cyan" : "gray"}> ● </Text>;
  }
  if (phaseIndex === 0) {
    return <Text color={isSelected ? "cyan" : "gray"}> ┌ </Text>;
  }
  if (phaseIndex === totalPhases - 1) {
    return <Text color={isSelected ? "cyan" : "gray"}> └ </Text>;
  }
  return <Text color={isSelected ? "cyan" : "gray"}> ├ </Text>;
}

function PhaseNode({
  phase,
  index,
  total,
  isSelected,
  isFocused,
}: {
  readonly phase: Phase;
  readonly index: number;
  readonly total: number;
  readonly isSelected: boolean;
  readonly isFocused: boolean;
}): React.ReactElement {
  const style = getPhaseStyle(phase.phaseType);
  const isLatest = index === total - 1;
  const tools = Object.keys(phase.toolSummary);
  const toolStr =
    tools.length > 3 ? `${tools.slice(0, 3).join(",")}+${tools.length - 3}` : tools.join(",");
  const tokens = formatTokenCount(phase.totalInputTokens + phase.totalOutputTokens);
  const duration = formatDuration(phase.startTime, phase.endTime);

  return (
    <Box flexDirection="column">
      <Box>
        {renderConnector(index, total, isSelected)}
        <Text
          color={isSelected && isFocused ? "cyan" : style.color}
          bold={isSelected}
          inverse={isSelected && isFocused}
        >
          [{style.label}]
        </Text>
        <Text bold={isSelected}> {phase.title}</Text>
        {isLatest && <Text color="green"> ◀ NOW</Text>}
      </Box>

      {/* Stats line */}
      <Box marginLeft={4}>
        <Text dimColor>
          {phase.turns.length}t {tokens}
          {toolStr ? ` ${toolStr}` : ""}
          {phase.filesChanged.length > 0 ? ` ${phase.filesChanged.length}f` : ""}
          {phase.subagentIds.length > 0 ? ` ${phase.subagentIds.length}a` : ""} {duration}
        </Text>
      </Box>

      {/* Connector line between phases */}
      {index < total - 1 && (
        <Box marginLeft={2}>
          <Text color="gray">│</Text>
        </Box>
      )}
    </Box>
  );
}

export function WorkflowTree({
  phases,
  selectedIndex,
  isFocused,
}: WorkflowTreeProps): React.ReactElement {
  if (phases.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No workflow phases yet</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {phases.map((phase, i) => (
        <PhaseNode
          key={phase.index}
          phase={phase}
          index={i}
          total={phases.length}
          isSelected={i === selectedIndex}
          isFocused={isFocused}
        />
      ))}
    </Box>
  );
}
