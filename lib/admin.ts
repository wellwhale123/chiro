import { cookies } from "next/headers";
import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "chiro_admin_session";

// 세션 비밀키: Vercel 환경변수 ADMIN_SESSION_SECRET 값을 사용합니다.
// (설정 안 했을 경우를 대비한 개발용 기본값이지만, 운영 환경에서는 반드시 직접 설정해야 합니다.)
function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || "dev-only-insecure-secret";
}

// 세션 토큰 생성: 현재 시각을 포함해서 서명합니다.
export function createSessionToken(): string {
  const issuedAt = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(issuedAt)
    .digest("hex");
  return `${issuedAt}.${signature}`;
}

// 세션 토큰 검증: 서명이 유효하고, 만료(기본 7일)되지 않았는지 확인합니다.
function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(issuedAt)
    .digest("hex");

  // 타이밍 공격 방지를 위해 timingSafeEqual 사용
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false;

  const issuedAtMs = Number(issuedAt);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - issuedAtMs > sevenDaysMs) return false;

  return true;
}

// Server Component / Route Handler에서 호출: 현재 요청이 관리자 세션인지 확인
export async function isAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}
