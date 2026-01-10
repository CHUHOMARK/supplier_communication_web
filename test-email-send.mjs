import nodemailer from "nodemailer";

// SMTP配置
const config = {
  host: "smtp.qq.com",
  port: 465,
  secure: true,
  auth: {
    user: "646193583@qq.com",
    pass: "flcchatrfufebdjb",
  },
};

console.log("[Test] Creating transporter with config:", {
  ...config,
  auth: { user: config.auth.user, pass: "****" },
});

const transporter = nodemailer.createTransport(config);

// 验证配置
console.log("[Test] Verifying SMTP connection...");
try {
  await transporter.verify();
  console.log("[Test] ✓ SMTP connection verified successfully");
} catch (error) {
  console.error("[Test] ✗ SMTP verification failed:", error.message);
  process.exit(1);
}

// 发送测试邮件
console.log("[Test] Sending test email...");
try {
  const info = await transporter.sendMail({
    from: '"供应商物料计划系统" <646193583@qq.com>',
    to: "zhuh_mew@yeah.net",
    subject: "【测试邮件】供应商物料计划沟通工具",
    text: "这是一封测试邮件，用于验证SMTP邮件发送功能。",
    html: `
      <h2>【测试邮件】供应商物料计划沟通工具</h2>
      <p>尊敬的供应商伙伴：</p>
      <p>您好！</p>
      <p>这是一封测试邮件，用于验证SMTP邮件发送功能。</p>
      <p>如果您收到此邮件，说明邮件服务配置成功。</p>
      <br/>
      <p>此致</p>
      <p>敬礼！</p>
    `,
  });

  console.log("[Test] ✓ Email sent successfully!");
  console.log("[Test] Message ID:", info.messageId);
  console.log("[Test] Response:", info.response);
} catch (error) {
  console.error("[Test] ✗ Failed to send email:", error.message);
  if (error.code) {
    console.error("[Test] Error code:", error.code);
  }
  process.exit(1);
}

console.log("[Test] All tests passed!");
