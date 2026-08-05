import crypto from "crypto";
import { getSessionSecret } from "./admin";

// 학교 이메일 인증: 서버에 상태를 저장하지 않고, 이메일+코드+만료시각을 서명한 토큰을
// 클라이언트에 들고 있게 하는 방식입니다 (관리자 세션 토큰과 동일한 원리).
const OTP_TTL_MS = 10 * 60 * 1000; // 10분

export const SCHOOL_EMAIL_DOMAIN = "@cau.ac.kr";

export function isSchoolEmail(email: string): boolean {
  return email.toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

// 6자리 인증코드를 생성하고, "이메일.코드.만료시각.서명" 형태의 토큰을 함께 반환합니다.
export function createEmailOtp(email: string): { code: string; token: string } {
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = (Date.now() + OTP_TTL_MS).toString();
  const payload = `${email}.${code}.${expiresAt}`;
  const signature = sign(payload);
  return { code, token: `${payload}.${signature}` };
}

// 토큰과 사용자가 입력한 코드가 서로 맞는지, 만료되지 않았는지 확인합니다.
export function verifyEmailOtp(token: string, email: string, code: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [tokenEmail, tokenCode, expiresAt, signature] = parts;

  const payload = `${tokenEmail}.${tokenCode}.${expiresAt}`;
  const expectedSignature = sign(payload);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false;

  if (Date.now() > Number(expiresAt)) return false;
  if (tokenEmail.toLowerCase() !== email.toLowerCase()) return false;
  if (tokenCode !== code) return false;

  return true;
}
