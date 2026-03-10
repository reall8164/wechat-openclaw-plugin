// ============================================
// WebSocket 模块导出
// ============================================

// 类型定义
export type {
  AGPEnvelope,
  AGPMethod,
  ContentBlock,
  ToolCall,
  ToolCallKind,
  ToolCallStatus,
  ToolLocation,
  PromptPayload,
  CancelPayload,
  UpdatePayload,
  UpdateType,
  PromptResponsePayload,
  StopReason,
  PromptMessage,
  CancelMessage,
  UpdateMessage,
  PromptResponseMessage,
  WebSocketClientConfig,
  ConnectionState,
  WebSocketClientCallbacks,
} from "./schema.js";

// WebSocket 客户端
export { WechatAccessWebSocketClient } from "./client.js";

// 消息处理器
export { handlePrompt, handleCancel } from "./session-orchestrator.js";

// 消息适配器
export {
  extractTextFromContent,
  promptPayloadToFuwuhaoMessage,
  buildWebSocketMessageContext,
} from "./bridge.js";
