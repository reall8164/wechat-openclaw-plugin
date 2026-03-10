import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type { FuwuhaoMessage, SimpleAccount } from "./contracts.js";
import { verifySignature, decryptMessage, encryptMessage } from "./envelope-crypto.js";
import { parseQuery, readBody, isFuwuhaoWebhookPath } from "./transport.js";
import { handleMessage, handleMessageStream } from "./reply-orchestrator.js";
import { getWecomRuntime } from "../../runtime/runtime-store.js";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  suppressEmptyNode: true,
  cdataPropName: "#cdata",
  format: false,
});

const createSignature = (token: string, timestamp: string, nonce: string, encrypt: string): string => {
  return createHash("sha1")
    .update([token, timestamp, nonce, encrypt].sort().join(""))
    .digest("hex");
};

const resolveWebhookAccount = (): SimpleAccount => {
  const cfg = (() => {
    try {
      return getWecomRuntime().config.loadConfig();
    } catch {
      return undefined;
    }
  })();

  const webhookCfg = cfg?.channels?.["wechat-access-unqclawed"]?.webhook;
  const token = String(webhookCfg?.token ?? process.env.WECHAT_ACCESS_TOKEN ?? "").trim();
  const encodingAESKey = String(
    webhookCfg?.encodingAESKey ?? process.env.WECHAT_ACCESS_ENCODING_AES_KEY ?? "",
  ).trim();
  const receiveId = String(webhookCfg?.receiveId ?? process.env.WECHAT_ACCESS_RECEIVE_ID ?? "").trim();

  if (!token || !encodingAESKey || !receiveId) {
    throw new Error("未配置 webhook 验签参数，请设置 token / encodingAESKey / receiveId");
  }

  return { token, encodingAESKey, receiveId };
};

const parseXml = (xml: string): Record<string, unknown> => {
  const parsed = xmlParser.parse(xml);
  return (parsed.xml ?? parsed) as Record<string, unknown>;
};

const parseRequestPayload = (body: string): { encrypt?: string; raw: Record<string, unknown> } => {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const encrypt = typeof json.encrypt === "string"
      ? json.encrypt
      : typeof json.Encrypt === "string"
        ? json.Encrypt
        : undefined;
    return { encrypt, raw: json };
  } catch {
    const xml = parseXml(body);
    const encrypt = typeof xml.Encrypt === "string"
      ? xml.Encrypt
      : typeof xml.encrypt === "string"
        ? xml.encrypt
        : undefined;
    return { encrypt, raw: xml };
  }
};

const toMessage = (body: string): FuwuhaoMessage => {
  try {
    return JSON.parse(body) as FuwuhaoMessage;
  } catch {
    return parseXml(body) as FuwuhaoMessage;
  }
};

const buildEncryptedReply = (
  account: SimpleAccount,
  message: FuwuhaoMessage,
  replyText: string,
  nonce: string,
  timestamp: string,
): string => {
  const plaintext = xmlBuilder.build({
    xml: {
      ToUserName: { "#cdata": message.FromUserName ?? "" },
      FromUserName: { "#cdata": message.ToUserName ?? account.receiveId },
      CreateTime: timestamp,
      MsgType: { "#cdata": "text" },
      Content: { "#cdata": replyText },
    },
  });

  const encrypt = encryptMessage(
    {
      encodingAESKey: account.encodingAESKey,
      receiveId: account.receiveId,
      encrypt: "",
    },
    plaintext,
  );

  return xmlBuilder.build({
    xml: {
      Encrypt: { "#cdata": encrypt },
      MsgSignature: { "#cdata": createSignature(account.token, timestamp, nonce, encrypt) },
      TimeStamp: timestamp,
      Nonce: { "#cdata": nonce },
    },
  });
};

export const handleSimpleWecomWebhook = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> => {
  if (!isFuwuhaoWebhookPath(req.url || "")) {
    return false;
  }

  console.log(`[wechat-access] 收到请求: ${req.method} ${req.url}`);

  try {
    const account = resolveWebhookAccount();
    const query = parseQuery(req);
    const timestamp = query.get("timestamp") || "";
    const nonce = query.get("nonce") || "";
    const signature = query.get("msg_signature") || query.get("signature") || "";

    if (req.method === "GET") {
      const echostr = query.get("echostr") || "";
      const isValid = verifySignature({
        token: account.token,
        timestamp,
        nonce,
        encrypt: echostr,
        signature,
      });

      if (!isValid) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("签名验证失败");
        return true;
      }

      const decrypted = decryptMessage({
        encodingAESKey: account.encodingAESKey,
        receiveId: account.receiveId,
        encrypt: echostr,
      });

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(decrypted);
      return true;
    }

    if (req.method !== "POST") {
      return false;
    }

    const body = await readBody(req);
    const { encrypt, raw } = parseRequestPayload(body);

    let message: FuwuhaoMessage;
    if (encrypt) {
      const isValid = verifySignature({
        token: account.token,
        timestamp,
        nonce,
        encrypt,
        signature,
      });

      if (!isValid) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("签名验证失败");
        return true;
      }

      message = toMessage(
        decryptMessage({
          encodingAESKey: account.encodingAESKey,
          receiveId: account.receiveId,
          encrypt,
        }),
      );
    } else {
      message = raw as FuwuhaoMessage;
    }

    const acceptHeader = req.headers.accept || "";
    const wantsStream = acceptHeader.includes("text/event-stream")
      || query.get("stream") === "true"
      || query.get("stream") === "1";

    if (wantsStream) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.flushHeaders();

      res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);

      try {
        await handleMessageStream(message, (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          if (chunk.type === "done" || chunk.type === "error") {
            res.end();
          }
        });
      } catch (streamErr) {
        res.write(`data: ${JSON.stringify({ type: "error", text: String(streamErr), timestamp: Date.now() })}\n\n`);
        res.end();
      }

      return true;
    }

    const reply = await handleMessage(message);
    const replyTimestamp = String(Math.floor(Date.now() / 1000));
    const replyNonce = nonce || `${Date.now()}`;

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.end(buildEncryptedReply(account, message, reply || "消息已接收，正在处理中...", replyNonce, replyTimestamp));
    return true;
  } catch (error) {
    console.error("[wechat-access] Webhook 处理异常:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("服务器内部错误");
    return true;
  }
};
