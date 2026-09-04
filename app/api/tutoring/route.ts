import { NextRequest, NextResponse } from "next/server";
import {
  getTutoringStats,
  submitTutoringRegistration,
  isClubMember,
  TUTORING_CAPACITY,
} from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PAYMENT_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_PAYMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function GET() {
  try {
    const stats = await getTutoringStats();
    return NextResponse.json({ success: true, capacity: TUTORING_CAPACITY, stats });
  } catch (error) {
    console.error("튜터링 현황 조회 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `현황을 불러오지 못했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = typeof form.get("name") === "string" ? (form.get("name") as string).trim() : "";
  const studentId =
    typeof form.get("studentId") === "string" ? (form.get("studentId") as string).trim() : "";
  const className = form.get("className") === "B" ? "B" : form.get("className") === "A" ? "A" : null;
  const paymentFileRaw = form.get("paymentFile");
  const paymentFile = paymentFileRaw instanceof File && paymentFileRaw.size > 0 ? paymentFileRaw : undefined;

  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!studentId) {
    return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  }
  if (!className) {
    return NextResponse.json({ error: "키네마틱스A반 / B반 중 하나를 선택해 주세요." }, { status: 400 });
  }

  try {
    const isMember = await isClubMember(name, studentId);
    if (!isMember) {
      return NextResponse.json(
        { error: "동아리원 명단에서 이름과 학번을 확인할 수 없어요. 외부인은 신청할 수 없습니다." },
        { status: 403 }
      );
    }

    // 신청 시점에 그 반이 이미 정원(28명)을 넘겼으면(=예비번호가 될 예정) 입금을 요구하지 않습니다.
    const statsBefore = await getTutoringStats();
    const willBeConfirmed = statsBefore[className].confirmedCount < TUTORING_CAPACITY;

    if (willBeConfirmed) {
      if (!paymentFile) {
        return NextResponse.json({ error: "입금 확인 스크린샷을 첨부해 주세요." }, { status: 400 });
      }
      if (!ALLOWED_PAYMENT_TYPES.includes(paymentFile.type)) {
        return NextResponse.json({ error: "입금 확인 사진은 이미지 파일만 가능합니다." }, { status: 400 });
      }
      if (paymentFile.size > MAX_PAYMENT_FILE_SIZE) {
        return NextResponse.json({ error: "입금 확인 사진은 8MB 이하로 올려주세요." }, { status: 400 });
      }
    }

    const { updated, result } = await submitTutoringRegistration(
      name,
      studentId,
      className,
      willBeConfirmed ? paymentFile : undefined
    );

    return NextResponse.json({ success: true, updated, result });
  } catch (error) {
    console.error("튜터링 신청 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
