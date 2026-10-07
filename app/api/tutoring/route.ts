import { NextRequest, NextResponse } from "next/server";
import {
  getTutoringOverview,
  submitTutoringRegistration,
  isClubMember,
  TutoringUserError,
  TUTORING_CAPACITY_PER_CLASS,
} from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PAYMENT_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_PAYMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function GET() {
  try {
    const { classes, hasTeammates } = await getTutoringOverview();
    return NextResponse.json({ success: true, capacity: TUTORING_CAPACITY_PER_CLASS, classes, hasTeammates });
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

  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v.trim() : "";
  };
  const name = str("name");
  const studentId = str("studentId");
  const className = str("className");
  const teammateNames = [str("teammate1"), str("teammate2"), str("teammate3")].filter(Boolean);
  const paymentFileRaw = form.get("paymentFile");
  const paymentFile = paymentFileRaw instanceof File && paymentFileRaw.size > 0 ? paymentFileRaw : undefined;

  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  if (!studentId) return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  if (!className) return NextResponse.json({ error: "분반을 선택해 주세요." }, { status: 400 });

  if (paymentFile) {
    if (!ALLOWED_PAYMENT_TYPES.includes(paymentFile.type)) {
      return NextResponse.json({ error: "입금 확인 사진은 이미지 파일만 가능합니다." }, { status: 400 });
    }
    if (paymentFile.size > MAX_PAYMENT_FILE_SIZE) {
      return NextResponse.json({ error: "입금 확인 사진은 8MB 이하로 올려주세요." }, { status: 400 });
    }
  }

  try {
    const isMember = await isClubMember(name, studentId);
    if (!isMember) {
      return NextResponse.json(
        { error: "동아리원 명단에서 이름과 학번을 확인할 수 없어요. 외부인은 신청할 수 없습니다." },
        { status: 403 }
      );
    }

    const { updated, result } = await submitTutoringRegistration(
      name,
      studentId,
      className,
      paymentFile,
      teammateNames
    );
    console.log(
      `[튜터링 신청] ${name} ${studentId} ${className} → ${
        result.status === "confirmed" ? `확정 ${result.rank}번째` : `예비 ${result.waitNumber}번`
      }`
    );
    return NextResponse.json({ success: true, updated, result });
  } catch (error) {
    if (error instanceof TutoringUserError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("튜터링 신청 실패:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${message ? ` (${message})` : ""}` },
      { status: 500 }
    );
  }
}
