import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ADMIN_COOKIE_NAME, createSessionToken } from "@/lib/admin";

// 간단한 요청 속도 제한 (같은 서버 인스턴스 내에서만 유효한 메모리 기반 제한입니다.
// 완벽한 보호는 아니지만, 무작위 대입 시도를 늦추는 최소한의 장치입니다.)
const attempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10분

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const record = attempts.get(ip);

  if (record) {
    if (now - record.firstAttempt > WINDOW_MS) {
      attempts.set(ip, { count: 1, firstAttempt: now });
    } else if (record.count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    } else {
      record.count += 1;
    }
  } else {
    attempts.set(ip, { count: 1, firstAttempt: now });
  }

  const body = await request.json().catch(() => null);
  const password = body?.password;

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "서버에 관리자 비밀번호가 설정되어 있지 않습니다. (ADMIN_PASSWORD 환경변수 필요)" },
      { status: 500 }
    );
  }

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const inputBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(adminPassword);

  const isMatch =
    inputBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(inputBuffer, expectedBuffer);

  if (!isMatch) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7일
  });

  return response;
}
