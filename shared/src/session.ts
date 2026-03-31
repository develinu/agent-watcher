export interface TokenUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_creation_input_tokens: number;
  readonly cache_read_input_tokens: number;
}

export interface TextBlock {
  readonly type: "text";
  readonly text: string;
}

export interface ToolUseBlock {
  readonly type: "tool_use";
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

export interface ToolResultBlock {
  readonly type: "tool_result";
  readonly tool_use_id: string;
  readonly content: string | readonly ContentBlock[];
}

export interface ThinkingBlock {
  readonly type: "thinking";
  readonly thinking: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

export interface AssistantMessage {
  readonly model: string;
  readonly id: string;
  readonly type: "message";
  readonly role: "assistant";
  readonly content: readonly ContentBlock[];
  readonly stop_reason: string;
  readonly usage: TokenUsage;
}

export interface UserRecord {
  readonly type: "user";
  readonly parentUuid: string | null;
  readonly isSidechain: boolean;
  readonly message: {
    readonly role: "user";
    readonly content: string | readonly ContentBlock[];
  };
  readonly uuid: string;
  readonly timestamp: string;
  readonly userType: string;
  readonly sessionId: string;
  readonly cwd: string;
  readonly version: string;
  readonly gitBranch?: string;
  readonly slug?: string;
  readonly entrypoint?: string;
  readonly permissionMode?: string;
}

export interface AssistantRecord {
  readonly type: "assistant";
  readonly parentUuid: string | null;
  readonly isSidechain: boolean;
  readonly agentId?: string;
  readonly message: AssistantMessage;
  readonly requestId: string;
  readonly uuid: string;
  readonly timestamp: string;
}

export interface SystemRecord {
  readonly type: "system";
  readonly subtype?: string;
  readonly uuid: string;
  readonly timestamp: string;
}

export interface AiTitleRecord {
  readonly type: "ai-title";
  readonly sessionId: string;
  readonly aiTitle: string;
}

export interface FileHistorySnapshot {
  readonly type: "file-history-snapshot";
  readonly uuid: string;
  readonly timestamp: string;
}

export interface QueueOperationRecord {
  readonly type: "queue-operation";
  readonly uuid: string;
  readonly timestamp: string;
}

export type JournalRecord =
  | UserRecord
  | AssistantRecord
  | SystemRecord
  | AiTitleRecord
  | FileHistorySnapshot
  | QueueOperationRecord;
