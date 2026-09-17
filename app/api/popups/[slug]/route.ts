import { NextRequest, NextResponse } from "next/server";
import {
  getPopupConfigBySlug,
  getPopupStats,
  submitPopupRegistration,
  findRosterMember,
  isPopupPeriodOver,
} from "@/lib/dynamicPopups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PAYMENT_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_PAYMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const popup = await getPopupConfigBySlug(slug);
    if (!popup) return NextResponse.json({ error: "팝업을 찾을 수 없습니다." }, { status: 404 });

    const stats = await getPopupStats(popup);
    return NextResponse.json({
      success: true,
      popup: {
        title: popup.title,
        description: popup.description,
        capacity: popup.capacity,
        useWaitlist: popup.useWaitlist,
        deadline: popup.deadline,
        depositAmount: popup.depositAmount,
        fields: popup.fields,
        teamSlotCount: popup.teamSlotCount,
        cancelManager: popup.cancelManager,
        periodOver: isPopupPeriodOver(popup),
      },
      ...stats,
    });
  } catch (error) {
    console.error(`팝업(${slug}) 현황 조회 실패:`, error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `현황을 불러오지 못했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const popup = await getPopupConfigBySlug(slug).catch(() => null);
  if (!popup) return NextResponse.json({ error: "팝업을 찾을 수 없습니다." }, { status: 404 });
  if (popup.status !== "활성" || isPopupPeriodOver(popup)) {
    return NextResponse.json({ error: "신청 기간이 아닙니다." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const name = typeof form.get("name") === "string" ? (form.get("name") as string).trim() : "";
  const studentId = typeof form.get("studentId") === "string" ? (form.get("studentId") as string).trim() : "";
  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  if (!studentId) return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });

  const teammateNames = popup.teamSlotCount
    ? Array.from({ length: popup.teamSlotCount }, (_, i) => form.get(`teammate${i + 1}`))
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  const paymentFileRaw = form.get("paymentFile");
  const paymentFile = paymentFileRaw instanceof File && paymentFileRaw.size > 0 ? paymentFileRaw : undefined;

  const extra: Record<string, string | boolean> = {};
  for (const field of popup.fields) {
    if (["이름", "학번", "학과", "학년"].includes(field.name) || field.type === "files") continue;
    const raw = form.get(field.name);
    if (raw === null) continue;
    if (field.type === "checkbox") extra[field.name] = raw === "true" || raw === "on";
    else if (typeof raw === "string") extra[field.name] = raw.trim();
  }

  try {
    const rosterMatch = await findRosterMember(popup.rosterUrl, name, studentId);
    if (!rosterMatch) {
      return NextResponse.json(
        { error: "동아리원 명단에서 이름과 학번을 확인할 수 없어요. 외부인은 신청할 수 없습니다." },
        { status: 403 }
      );
    }
    // 명단(기본 통합 명단)에서 확인된 학과/학년은 사용자가 입력하지 않고 항상 서버에서 자동으로 채웁니다.
    if (rosterMatch.department) extra["학과"] = rosterMatch.department;
    if (rosterMatch.year) extra["학년"] = rosterMatch.year;

    // 신청 시점에 이미 정원을 넘겼으면(=예비번호가 될 예정) 입금을 받지 않습니다.
    const statsBefore = await getPopupStats(popup);
    const willBeConfirmed = !popup.capacity || statsBefore.confirmedCount < popup.capacity;

    if (willBeConfirmed && popup.depositAmount) {
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

    const { updated, result } = await submitPopupRegistration(popup, {
      name,
      studentId,
      teammateNames,
      paymentFile: willBeConfirmed ? paymentFile : undefined,
      extra,
    });

    if (result.status === "full") {
      return NextResponse.json({ error: "정원이 마감되었습니다." }, { status: 409 });
    }

    return NextResponse.json({ success: true, updated, result });
  } catch (error) {
    console.error(`팝업(${slug}) 신청 실패:`, error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
