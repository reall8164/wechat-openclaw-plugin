/**
 * @file qr-exchange.ts
 * @description 微信 QR 扫码登录轮询逻辑
 *
 * 流程：获取 state → 抓取 QR 页面拿 uuid → 长轮询扫码状态 → 拿到 code
 */

import type { QClawEnvironment } from "./contracts.js";

/** 构造微信 OAuth2 授权 URL */
export const buildAuthUrl = (state: string, env: QClawEnvironment): string => {
  const params = new URLSearchParams({
    appid: env.wxAppId,
    redirect_uri: env.wxLoginRedirectUri,
    response_type: "code",
    scope: "snsapi_login",
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
};

/** 从微信 QR 登录页面 HTML 中提取 uuid */
export const fetchQrUuid = async (authUrl: string): Promise<string> => {
  const res = await fetch(authUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15_000),
  });
  const html = await res.text();
  const match = html.match(/\/connect\/qrcode\/([a-zA-Z0-9_=-]+)/);
  if (!match?.[1]) {
    throw new Error("无法从微信登录页面提取 QR UUID");
  }
  return match[1];
};

/** 抓取微信 QR 码图片并返回 base64 data URL */
export const fetchQrImageDataUrl = async (uuid: string): Promise<string> => {
  const url = `https://open.weixin.qq.com/connect/qrcode/${uuid}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/png";
  return `data:${contentType};base64,${buf.toString("base64")}`;
};

export interface QrPollResult {
  /** waiting=未扫码, scanned=已扫码待确认, confirmed=已确认(含code), expired=过期, error=异常 */
  status: "waiting" | "scanned" | "confirmed" | "expired" | "error";
  code?: string;
}

/**
 * 长轮询微信扫码状态
 *
 * 微信返回的 errcode：
 * - 408: 等待扫码（长轮询超时，需重试）
 * - 404: 已扫码，等待用户在手机上确认
 * - 405: 已确认，wx_code 里带授权 code
 * - 403/402: 二维码过期
 */
export const pollQrStatus = async (uuid: string): Promise<QrPollResult> => {
  try {
    const url = `https://lp.open.weixin.qq.com/connect/l/qrconnect?uuid=${uuid}&_=${Date.now()}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();

    const errMatch = text.match(/wx_errcode=(\d+)/);
    const codeMatch = text.match(/wx_code='([^']*)'/);
    const errCode = errMatch ? parseInt(errMatch[1], 10) : 0;
    const wxCode = codeMatch?.[1] || "";

    if (errCode === 408) return { status: "waiting" };
    if (errCode === 404) return { status: "scanned" };
    if (errCode === 405 && wxCode) return { status: "confirmed", code: wxCode };
    if (errCode === 403 || errCode === 402) return { status: "expired" };
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
};
