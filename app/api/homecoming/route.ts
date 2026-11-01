import { NextRequest, NextResponse } from "next/server";
import {
  getPopupStats,
  submitPopupRegistration,
  findRosterMember,
  resyncPopupRanksThrottled,
} from "@/lib/dynamicPopups";
import { getHomecomingPopup, isHomecomingClosed, isValidEmail, saveHomecomingEmail } from "@/lib/homecoming";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const popup = await getHomecomingPopup();
    await resyncPopupRanksThrottled(popup).catch((error) => {
      console.error("홈커밍 순번 자동 재정렬 실패:", error);
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
        periodOver: isHomecomingClosed(popup),
      },
      ...stats,
    });
  } catch (error) {
    console.error("홈커밍 현황 조회 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `현황을 불러오지 못했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const popup = await getHomecomingPopup().catch(() => null);
  if (!popup) return NextResponse.json({ error: "팝업을 불러오지 못했습니다." }, { status: 500 });
  if (isHomecomingClosed(popup)) {
    return NextResponse.json({ error: "신청 기간이 아닙니다." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v.trim() : "";
  };
  const name = str("name");
  const studentId = str("studentId");
  const contactEmail = str("contactEmail");
  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  if (!studentId) return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  if (contactEmail && !isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "이메일 주소를 다시 확인해 주세요." }, { status: 400 });
  }

  const extra: Record<string, string | boolean> = {};
  for (const field of popup.fields) {
    const value = str(field.name);
    if (value) extra[field.name] = value;
  }

  try {
    const rosterMatch = await findRosterMember(popup.rosterUrl, name, studentId);
    if (!rosterMatch) {
      return NextResponse.json(
        { error: "동아리원 명단에서 이름과 학번을 확인할 수 없어요. 외부인은 신청할 수 없습니다." },
        { status: 403 }
      );
    }
    if (rosterMatch.department) extra["학과"] = rosterMatch.department;
    if (rosterMatch.year) extra["학년"] = rosterMatch.year;

    const { updated, result } = await submitPopupRegistration(popup, { name, studentId, extra });
    if (result.status === "full") {
      return NextResponse.json({ error: "정원이 마감되었습니다." }, { status: 409 });
    }

    // 예비번호 신청자가 "연락 받기"를 선택한 경우에만 이메일을 저장합니다.
    let emailSaved = false;
    if (contactEmail && result.status === "waitlisted") {
      try {
        await saveHomecomingEmail(studentId, contactEmail);
        emailSaved = true;
      } catch (error) {
        console.error(`홈커밍 이메일 저장 실패 (${name} ${studentId} ${contactEmail}):`, error);
      }
    }

    return NextResponse.json({ success: true, updated, result, emailSaved });
  } catch (error) {
    console.error("홈커밍 신청 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
