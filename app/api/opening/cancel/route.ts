import { NextRequest, NextResponse } from "next/server";
import { cancelOpeningRegistration } from "@/lib/notion";
import { verifyEmailOtpDebug, isSchoolEmail } from "@/lib/otp";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!name || !studentId) {
    return NextResponse.json({ error: "이름과 학번을 모두 입력해 주세요." }, { status: 400 });
  }
  if (!isSchoolEmail(email)) {
    return NextResponse.json({ error: "학교 이메일(@cau.ac.kr)로 인증을 먼저 받아주세요." }, { status: 400 });
  }
  if (!code || !token) {
    return NextResponse.json({ error: "이메일 인증코드를 입력해 주세요." }, { status: 400 });
  }
  const otpCheck = verifyEmailOtpDebug(token, email, code);
  if (!otpCheck.valid) {
    // TODO: 원인 파악되면 (debug: ...) 부분 제거
    return NextResponse.json(
      { error: `인증코드가 올바르지 않거나 만료되었습니다. (debug: ${otpCheck.reason})` },
      { status: 400 }
    );
  }

  try {
    const result = await cancelOpeningRegistration(name, studentId);

    if (!result.found) {
      return NextResponse.json(
        { error: "일치하는 신청 내역을 찾을 수 없어요. 이름과 학번을 다시 확인해 주세요." },
        { status: 404 }
      );
    }
    if (result.alreadyCancelled) {
      return NextResponse.json({ success: true, alreadyCancelled: true });
    }

    return NextResponse.json({ success: true, alreadyCancelled: false });
  } catch (error) {
    console.error("개강총회 신청 취소 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `취소 처리 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
