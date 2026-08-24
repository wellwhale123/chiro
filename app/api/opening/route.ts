import { NextRequest, NextResponse } from "next/server";
import {
  getOpeningCapacityInfo,
  getOpeningRegistrations,
  createOpeningRegistration,
  OPENING_CAPACITY,
  OPENING_START_TIME,
} from "@/lib/notion";

function hasStarted(): boolean {
  return Date.now() >= new Date(OPENING_START_TIME).getTime();
}

// 팝업이 뜰 때 현재 신청 현황(정원/예비번호)과 접수 시작 여부를 보여주기 위한 조회
export async function GET() {
  try {
    const started = hasStarted();
    // 접수 시작 전에는 정원 정보를 미리 공개하지 않고, 시작 시각만 알려줍니다.
    const info = started
      ? await getOpeningCapacityInfo()
      : { capacity: OPENING_CAPACITY, confirmedCount: 0, waitlistCount: 0, total: 0 };

    return NextResponse.json({
      success: true,
      ...info,
      startTime: OPENING_START_TIME,
      started,
    });
  } catch (error) {
    console.error("개강총회 신청 현황 조회 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 현황을 불러오지 못했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

// 참고: 학교 이메일 인증(코드 발송/확인)은 lib/otp.ts, lib/mailer.ts, /api/opening/send-code 에
// 구현은 되어 있지만 지금은 요청에 사용하지 않습니다 (추후 재활성화 가능).
export async function POST(request: NextRequest) {
  if (!hasStarted()) {
    return NextResponse.json(
      { error: "아직 접수 시작 전입니다. 잠시 후 다시 시도해 주세요." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!studentId) {
    return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  }

  try {
    // 취소하지 않은(활성) 신청 중 같은 학번이 이미 있으면 새로 만들지 않고 기존 순번을 그대로 안내합니다.
    // (취소된 신청은 다시 신청할 수 있도록 중복 검사에서 제외합니다.)
    const existing = await getOpeningRegistrations();
    const active = existing.filter((r) => !r.cancelled);
    const dupIndex = active.findIndex((r) => r.studentId === studentId);
    if (dupIndex !== -1) {
      const rank = dupIndex + 1;
      if (rank <= OPENING_CAPACITY) {
        return NextResponse.json({ success: true, status: "confirmed", alreadyRegistered: true });
      }
      return NextResponse.json({
        success: true,
        status: "waitlist",
        waitlistNumber: rank - OPENING_CAPACITY,
        alreadyRegistered: true,
      });
    }

    const result = await createOpeningRegistration(name, studentId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("개강총회 신청 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
