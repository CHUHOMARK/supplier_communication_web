import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * 邮件发送服务
 * 支持SMTP配置和邮件发送功能
 */

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

let transporter: Transporter | null = null;

/**
 * 初始化邮件传输器
 */
export function initializeEmailTransporter(config: EmailConfig): void {
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
  });
}

/**
 * 从环境变量初始化邮件服务
 */
export function initializeFromEnv(): boolean {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !port || !user || !pass) {
    console.warn("[EmailService] SMTP configuration not found in environment variables");
    return false;
  }

  initializeEmailTransporter({
    host,
    port: parseInt(port, 10),
    secure,
    auth: { user, pass },
  });

  console.log("[EmailService] Initialized with host:", host);
  return true;
}

/**
 * 使用指定的SMTP账号发送邮件
 */
export async function sendEmailWithAccount(
  options: EmailOptions,
  smtpAccount: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName?: string | null;
  }
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    // 为每次发送创建一个新的传输器
    const accountTransporter = nodemailer.createTransport({
      host: smtpAccount.smtpHost,
      port: smtpAccount.smtpPort,
      secure: smtpAccount.smtpSecure,
      auth: {
        user: smtpAccount.smtpUser,
        pass: smtpAccount.smtpPassword,
      },
    });

    const from = smtpAccount.fromName
      ? `${smtpAccount.fromName} <${smtpAccount.fromEmail}>`
      : smtpAccount.fromEmail;

    const info = await accountTransporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("[EmailService] Failed to send email with account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "邮件发送失败",
    };
  }
}

/**
 * 发送邮件（使用环境变量配置）
 */
export async function sendEmail(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  if (!transporter) {
    return {
      success: false,
      error: "邮件服务未配置，请在环境变量中设置SMTP相关配置",
    };
  }

  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("[EmailService] Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "邮件发送失败",
    };
  }
}

/**
 * 验证邮件服务配置
 */
export async function verifyEmailService(): Promise<boolean> {
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error("[EmailService] Verification failed:", error);
    return false;
  }
}

// 自动从环境变量初始化
initializeFromEnv();
