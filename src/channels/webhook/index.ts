// ============================================
// Webhook 通道导出
// ============================================

export type {
  AgentEventPayload,
  FuwuhaoMessage,
  SimpleAccount,
  CallbackPayload,
  StreamChunk,
  StreamCallback,
} from "./contracts.js";

export type {
  VerifySignatureParams,
  DecryptMessageParams,
} from "./envelope-crypto.js";

export {
  verifySignature,
  decryptMessage,
  encryptMessage,
} from "./envelope-crypto.js";

export {
  parseQuery,
  readBody,
  isFuwuhaoWebhookPath,
} from "./transport.js";

export {
  sendToCallbackService,
} from "./callback-sink.js";

export type {
  MessageContext,
} from "../../routing/context-builder.js";

export {
  buildMessageContext,
  WECHAT_CHANNEL_LABELS,
} from "../../routing/context-builder.js";

export {
  handleMessage,
  handleMessageStream,
} from "./reply-orchestrator.js";

export {
  handleSimpleWecomWebhook,
} from "./router.js";

export {
  getWecomRuntime,
} from "../../runtime/runtime-store.js";
