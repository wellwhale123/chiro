import { NextRequest, NextResponse } from "next/server";
import {
  submitOpeningRegistration,
  isClubMember,
  getAfterParty1Stats,
  promoteAfterParty1Waitlist,
  AFTER_PARTY1_CAPACITY,
  OPENING_START_TIME,
} from "@/lib/notion";

// 매번 최신 신청 인원을 반영해야 하므로 정적 캐싱을 끕니다.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PAYMENT_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_PAYMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function hasStarted(): boolean {
  return Date.now() >= new Date(OPENING_START_TIME).getTime();
}

// 임시 테스트용: 9시 40분까지만 여석을 1개로 보이게 표시 (실제 신청/정원 로직에는 영향 없음, 화면 표시만).
// 이 시각이 지나면 자동으로 원래 실제 값으로 돌아갑니다.
const TEST_OVERRIDE_UNTIL = "2026-08-31T09:40:00+09:00";
function isTestOverrideActive(): boolean {
  return Date.now() < new Date(TEST_OVERRIDE_UNTIL).getTime();
}

// 팝업이 뜰 때 접수 시작 여부와 뒷풀이 1차 정원 현황을 확인합니다.
// 겸사겸사, 대기 중이었다가 앞사람이 빠져 확정된 사람에게 보낼 알림 메일도 확인해서 보냅니다.
export async function GET() {
  const started = hasStarted();
  if (started) {
    await promoteAfterParty1Waitlist().catch((error) => {
      console.error("대기자 승격 확인 실패:", error);
    });
  }
  const stats = started
    ? await getAfterParty1Stats().catch(() => ({
        capacity: AFTER_PARTY1_CAPACITY,
        confirmedCount: 0,
        waitingCount: 0,
      }))
    : { capacity: AFTER_PARTY1_CAPACITY, confirmedCount: 0, waitingCount: 0 };

  const displayConfirmedCount = isTestOverrideActive()
    ? Math.max(0, stats.capacity - 1)
    : stats.confirmedCount;

  return NextResponse.json({
    success: true,
    started,
    startTime: OPENING_START_TIME,
    afterParty1Capacity: stats.capacity,
    afterParty1ConfirmedCount: displayConfirmedCount,
    afterParty1WaitingCount: stats.waitingCount,
  });
}

export async function POST(request: NextRequest) {
  if (!hasStarted()) {
    return NextResponse.json(
      { error: "아직 접수 시작 전입니다. 잠시 후 다시 시도해 주세요." },
      { status: 403 }
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = typeof form.get("name") === "string" ? (form.get("name") as string).trim() : "";
  const studentId =
    typeof form.get("studentId") === "string" ? (form.get("studentId") as string).trim() : "";
  const opening = form.get("opening") === "true";
  const afterParty1 = form.get("afterParty1") === "true";
  const afterParty2 = form.get("afterParty2") === "true";
  const waitlistEmailRaw = form.get("waitlistEmail");
  const waitlistEmail =
    typeof waitlistEmailRaw === "string" && waitlistEmailRaw.trim() ? waitlistEmailRaw.trim() : undefined;
  const paymentFileRaw = form.get("paymentFile");
  const paymentFile = paymentFileRaw instanceof File && paymentFileRaw.size > 0 ? paymentFileRaw : undefined;

  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!studentId) {
    return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  }
  if (!opening && !afterParty1 && !afterParty2) {
    return NextResponse.json(
      { error: "개강총회 / 뒷풀이1차 / 뒷풀이2차 중 최소 하나는 선택해 주세요." },
      { status: 400 }
    );
  }
  if (!paymentFile && afterParty1) {
    return NextResponse.json(
      { error: "뒷풀이 1차를 신청하시려면 입금 확인 스크린샷을 첨부해 주세요." },
      { status: 400 }
    );
  }
  if (paymentFile && !ALLOWED_PAYMENT_TYPES.includes(paymentFile.type)) {
    return NextResponse.json({ error: "입금 확인 사진은 이미지 파일만 가능합니다." }, { status: 400 });
  }
  if (paymentFile && paymentFile.size > MAX_PAYMENT_FILE_SIZE) {
    return NextResponse.json({ error: "입금 확인 사진은 8MB 이하로 올려주세요." }, { status: 400 });
  }

  try {
    const isMember = await isClubMember(name, studentId);
    if (!isMember) {
      return NextResponse.json(
        { error: "동아리원 명단에서 이름과 학번을 확인할 수 없어요. 외부인은 신청할 수 없습니다." },
        { status: 403 }
      );
    }

    const result = await submitOpeningRegistration(
      name,
      studentId,
      { opening, afterParty1, afterParty2 },
      paymentFile,
      waitlistEmail
    );

    return NextResponse.json({
      success: true,
      updated: result.updated,
      logTime: result.logTime,
      afterParty1: result.afterParty1,
    });
  } catch (error) {
    console.error("개강총회 신청 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
