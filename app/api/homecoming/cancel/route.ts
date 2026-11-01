import { NextRequest, NextResponse } from "next/server";
import { cancelPopupRegistration } from "@/lib/dynamicPopups";
import { getHomecomingContact, getHomecomingPopup, isHomecomingClosed, notifyHomecomingPromotions } from "@/lib/homecoming";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 본인 취소: 이름+학번이 일치하는 신청을 노션 휴지통으로 옮기고(복구 가능), 그로 인해
// 예비번호에서 확정으로 올라온 사람에게 안내 메일을 보냅니다. 신청 마감 후에는 본인 취소를 막고,
// 운영진 확인을 거쳐서만 취소할 수 있게 합니다.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
  if (!name || !studentId) {
    return NextResponse.json({ error: "이름과 학번을 모두 입력해 주세요." }, { status: 400 });
  }

  try {
    const popup = await getHomecomingPopup();
    if (isHomecomingClosed(popup)) {
      return NextResponse.json(
        { error: `신청이 마감되어 직접 취소할 수 없습니다. 취소는 ${getHomecomingContact()}에게 문의해 주세요.` },
        { status: 403 }
      );
    }
    const outcome = await cancelPopupRegistration(popup, name, studentId);
    if (!outcome.found) {
      return NextResponse.json(
        { error: "일치하는 신청 내역을 찾을 수 없어요. 이름과 학번을 다시 확인해 주세요." },
        { status: 404 }
      );
    }
    await notifyHomecomingPromotions(outcome.promoted);
    return NextResponse.json({ success: true, canceledResult: outcome.canceledResult });
  } catch (error) {
    console.error("홈커밍 취소 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `취소 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
