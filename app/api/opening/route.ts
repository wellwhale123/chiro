import { NextRequest, NextResponse } from "next/server";
import {
  submitOpeningRegistration,
  isClubMember,
  getAfterParty1Count,
  AFTER_PARTY1_CAPACITY,
  OPENING_START_TIME,
} from "@/lib/notion";

const MAX_PAYMENT_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_PAYMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function hasStarted(): boolean {
  return Date.now() >= new Date(OPENING_START_TIME).getTime();
}

// 팝업이 뜰 때 접수 시작 여부와 뒷풀이 1차 정원 현황을 확인합니다.
export async function GET() {
  const started = hasStarted();
  const afterParty1Count = started ? await getAfterParty1Count().catch(() => 0) : 0;

  return NextResponse.json({
    success: true,
    started,
    startTime: OPENING_START_TIME,
    afterParty1Count,
    afterParty1Capacity: AFTER_PARTY1_CAPACITY,
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
  if (!paymentFile) {
    return NextResponse.json({ error: "입금 확인 스크린샷을 첨부해 주세요." }, { status: 400 });
  }
  if (!ALLOWED_PAYMENT_TYPES.includes(paymentFile.type)) {
    return NextResponse.json({ error: "입금 확인 사진은 이미지 파일만 가능합니다." }, { status: 400 });
  }
  if (paymentFile.size > MAX_PAYMENT_FILE_SIZE) {
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
      paymentFile
    );

    return NextResponse.json({ success: true, updated: result.updated });
  } catch (error) {
    console.error("개강총회 신청 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
