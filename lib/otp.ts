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

// 이메일 안의 '.'이 토큰 구분자와 겹치지 않도록 base64url로 인코딩해 담습니다.
function encodeEmail(email: string): string {
  return Buffer.from(email, "utf8").toString("base64url");
}
function decodeEmail(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

// 6자리 인증코드를 생성하고, "이메일(인코딩).코드.만료시각.서명" 형태의 토큰을 함께 반환합니다.
export function createEmailOtp(email: string): { code: string; token: string } {
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = (Date.now() + OTP_TTL_MS).toString();
  const payload = `${encodeEmail(email)}.${code}.${expiresAt}`;
  const signature = sign(payload);
  return { code, token: `${payload}.${signature}` };
}

// 토큰과 사용자가 입력한 코드가 서로 맞는지, 만료되지 않았는지 확인합니다.
export function verifyEmailOtp(token: string, email: string, code: string): boolean {
  return verifyEmailOtpDebug(token, email, code).valid;
}

// 어느 단계에서 실패했는지 알려주는 디버그용 버전 (문제 원인 파악 후 제거 예정)
export function verifyEmailOtpDebug(
  token: string,
  email: string,
  code: string
): { valid: boolean; reason?: string } {
  const parts = token.split(".");
  if (parts.length !== 4) return { valid: false, reason: `bad_format(parts=${parts.length})` };
  const [encodedEmail, tokenCode, expiresAt, signature] = parts;

  const payload = `${encodedEmail}.${tokenCode}.${expiresAt}`;
  const expectedSignature = sign(payload);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: "sig_length_mismatch" };
  }
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: "sig_mismatch" };
  }

  if (Date.now() > Number(expiresAt)) return { valid: false, reason: "expired" };

  let tokenEmail: string;
  try {
    tokenEmail = decodeEmail(encodedEmail);
  } catch {
    return { valid: false, reason: "decode_failed" };
  }
  if (tokenEmail.toLowerCase() !== email.toLowerCase()) {
    return { valid: false, reason: `email_mismatch(${tokenEmail}!=${email})` };
  }
  if (tokenCode !== code) return { valid: false, reason: "code_mismatch" };

  return { valid: true };
}
