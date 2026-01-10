import { nanoid } from "nanoid";

/**
 * 生成唯一的确认token
 */
export function generateConfirmToken(): string {
  return nanoid(32);
}

/**
 * 计算确认链接的过期时间（默认30天）
 */
export function calculateExpiryDate(days: number = 30): Date {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate;
}

/**
 * 检查token是否过期
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * 生成确认链接URL
 */
export function generateConfirmationUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.VITE_APP_URL || "http://localhost:3000";
  return `${base}/confirm/${token}`;
}
