import { NextRequest, NextResponse } from "next/server";
import {
  getPopupConfigBySlug,
  getPopupStats,
  submitPopupRegistration,
  findRosterMember,
  findRosterMemberByName,
  isPopupPeriodOver,
  isPopupNotStartedYet,
  resyncPopupRanksThrottled,
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

    // 신청이 몰려서 순번이 꼬였더라도(동시 신청 등) 아무도 새로 신청하지 않으면 영영 안 고쳐지므로,
    // 조회할 때 순번을 다시 맞춰줍니다. 단, 사람이 몰릴 때 Notion API가 과부하(rate limit)로
    // 사이트 전체가 느려지는 걸 막기 위해 팝업당 60초에 한 번으로 제한합니다.
    await resyncPopupRanksThrottled(popup).catch((error) => {
      console.error(`팝업(${slug}) 순번 자동 재정렬 실패:`, error);
    });

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
        checkRoster: popup.checkRoster,
        periodOver: isPopupPeriodOver(popup) || isPopupNotStartedYet(popup),
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
  if (popup.status !== "활성" || isPopupPeriodOver(popup) || isPopupNotStartedYet(popup)) {
    return NextResponse.json({ error: "신청 기간이 아닙니다." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const name = typeof form.get("name") === "string" ? (form.get("name") as string).trim() : "";
  let studentId = typeof form.get("studentId") === "string" ? (form.get("studentId") as string).trim() : "";
  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  // "명단 체크"가 켜진 팝업만 학번을 바로 요구합니다. 꺼진 팝업은 이름만 받습니다.
  if (popup.checkRoster && !studentId) {
    return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  }

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
    if (["이름", "학번", "학과", "학년", "입금확인", "팀원희망", "신청순위"].includes(field.name) || field.type === "files")
      continue;
    const raw = form.get(field.name);
    if (raw === null) continue;
    if (field.type === "checkbox") extra[field.name] = raw === "true" || raw === "on";
    else if (typeof raw === "string") extra[field.name] = raw.trim();
  }

  try {
    if (popup.checkRoster) {
      // 기존과 동일: 이름+학번이 명단에 정확히 일치해야만 신청을 받습니다(외부인 차단).
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
    } else {
      // 명단 체크가 꺼진 팝업: 이름만으로 명단에서 찾아봅니다.
      // 찾으면 학번/학과/학년을 자동으로 채우고, 못 찾으면(외부인/신규/동명이인 등) 학번/학과/
      // 학년을 비워둔 채 이름만으로 신청을 그대로 받아줍니다(제한하지 않음).
      const byName = await findRosterMemberByName(popup.rosterUrl, name);
      if (byName) {
        studentId = byName.studentId;
        if (byName.department) extra["학과"] = byName.department;
        if (byName.year) extra["학년"] = byName.year;
      }
    }

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
