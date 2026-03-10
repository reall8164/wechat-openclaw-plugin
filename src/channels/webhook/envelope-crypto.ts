import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

// ============================================
// 加密解密工具
// ============================================
// 处理微信服务号的消息加密、解密和签名验证
// 微信使用 AES-256-CBC 加密算法和 SHA-1 签名算法

/**
 * 验证签名参数接口
 * @property token - 微信服务号配置的 Token
 * @property timestamp - 时间戳
 * @property nonce - 随机数
 * @property encrypt - 加密的消息内容
 * @property signature - 微信生成的签名，用于验证消息来源
 */
export interface VerifySignatureParams {
  token: string;
  timestamp: string;
  nonce: string;
  encrypt: string;
  signature: string;
}

/**
 * 解密消息参数接口
 * @property encodingAESKey - 微信服务号配置的 EncodingAESKey（43位字符）
 * @property receiveId - 接收方 ID（通常是服务号的原始 ID）
 * @property encrypt - 加密的消息内容（Base64 编码）
 */
export interface DecryptMessageParams {
  encodingAESKey: string;
  receiveId: string;
  encrypt: string;
}

/**
 * 验证微信消息签名
 * @param params - 签名验证参数
 * @returns 签名是否有效
 * @description 
 * 验证流程：
 * 1. 将 token、timestamp、nonce、encrypt 按字典序排序
 * 2. 拼接成字符串
 * 3. 进行 SHA-1 哈希
 * 4. 与微信提供的 signature 比对
 * 
 * **注意：当前为简化实现，生产环境需要实现真实的 SHA-1 签名验证**
 */
export const verifySignature = (params: VerifySignatureParams): boolean => {
  const arr = [params.token, params.timestamp, params.nonce, params.encrypt].sort();
  const expected = createHash("sha1").update(arr.join("")).digest("hex");
  const actual = params.signature.trim().toLowerCase();

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
};

/**
 * 解密微信消息
 * @param params - 解密参数
 * @returns 解密后的明文消息（JSON 字符串）
 * @description 
 * 解密流程：
 * 1. 将 Base64 编码的 encrypt 解码为二进制
 * 2. 使用 AES-256-CBC 算法解密（密钥由 encodingAESKey 派生）
 * 3. 去除填充（PKCS7）
 * 4. 提取消息内容（格式：随机16字节 + 4字节消息长度 + 消息内容 + receiveId）
 * 5. 验证 receiveId 是否匹配
 * 
 * **注意：当前为简化实现，返回模拟数据，生产环境需要实现真实的 AES 解密**
 */
export const decryptMessage = (params: DecryptMessageParams): string => {
  const key = Buffer.from(`${params.encodingAESKey}=`, "base64");
  if (key.length !== 32) {
    throw new Error("encodingAESKey 无效");
  }

  const iv = key.subarray(0, 16);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(false);

  const encrypted = Buffer.from(params.encrypt, "base64");
  let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const pad = decrypted[decrypted.length - 1];

  if (pad < 1 || pad > 32) {
    throw new Error("无效的 PKCS7 padding");
  }

  decrypted = decrypted.subarray(0, decrypted.length - pad);
  const payload = decrypted.subarray(16);
  const msgLen = payload.readUInt32BE(0);
  const message = payload.subarray(4, 4 + msgLen).toString("utf8");
  const receiveId = payload.subarray(4 + msgLen).toString("utf8");

  if (receiveId !== params.receiveId) {
    throw new Error("receiveId 不匹配");
  }

  return message;
};

export const encryptMessage = (params: DecryptMessageParams, plaintext: string): string => {
  const key = Buffer.from(`${params.encodingAESKey}=`, "base64");
  if (key.length !== 32) {
    throw new Error("encodingAESKey 无效");
  }

  const iv = key.subarray(0, 16);
  const random16 = randomBytes(16);
  const message = Buffer.from(plaintext, "utf8");
  const msgLen = Buffer.alloc(4);
  msgLen.writeUInt32BE(message.length, 0);
  const corpId = Buffer.from(params.receiveId, "utf8");
  let payload = Buffer.concat([random16, msgLen, message, corpId]);

  const blockSize = 32;
  const remainder = payload.length % blockSize;
  const pad = remainder === 0 ? blockSize : blockSize - remainder;
  payload = Buffer.concat([payload, Buffer.alloc(pad, pad)]);

  const cipher = createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(payload), cipher.final()]).toString("base64");
};
