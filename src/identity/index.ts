/**
 * @file index.ts
 * @description 认证模块导出
 */

export type {
  QClawEnvironment,
  LoginCredentials,
  PersistedAuthState,
  QClawApiResponse,
} from "./contracts.js";
export { TokenExpiredError } from "./contracts.js";

export { getEnvironment } from "./profile-map.js";
export { getDeviceGuid } from "./device-fingerprint.js";
export { QClawAPI } from "./remote-api.js";
export { loadState, saveState, clearState, getAccountStatePath } from "./persisted-session.js";
export { performLogin } from "./browser-flow.js";
export type { PerformLoginOptions } from "./browser-flow.js";
export { buildAuthUrl, fetchQrUuid, fetchQrImageDataUrl, pollQrStatus } from "./qr-exchange.js";
export type { QrPollResult } from "./qr-exchange.js";
