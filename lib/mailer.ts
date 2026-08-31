import nodemailer from "nodemailer";

// SMTP 계정 정보는 Vercel 환경변수로 설정합니다.
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, (선택) SMTP_FROM
function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("이메일 발송 설정(SMTP_HOST/SMTP_USER/SMTP_PASS)이 되어있지 않습니다.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465는 SSL, 587 등은 STARTTLS
    auth: { user, pass },
  });
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  bcc?: string;
}): Promise<void> {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transport.sendMail({
    from: `CHIRO <${from}>`,
    to: options.to,
    bcc: options.bcc,
    subject: options.subject,
    html: options.html,
  });
}
