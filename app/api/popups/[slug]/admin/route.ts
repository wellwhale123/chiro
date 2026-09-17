import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";
import {
  getPopupConfigBySlug,
  setPopupStatus,
  deletePopupConfig,
  updatePopupConfig,
  type PopupConfigInput,
} from "@/lib/dynamicPopups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 상태 변경(일시중지/재활성화) 또는 설정 수정
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

  const { slug } = await params;
  const popup = await getPopupConfigBySlug(slug).catch(() => null);
  if (!popup) return NextResponse.json({ error: "팝업을 찾을 수 없습니다." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    if (body.status === "활성" || body.status === "일시중지") {
      await setPopupStatus(popup.id, body.status);
      return NextResponse.json({ success: true });
    }

    if (body.config && typeof body.config === "object") {
      const c = body.config as Record<string, unknown>;
      const input: PopupConfigInput = {
        title: typeof c.title === "string" ? c.title.trim() : popup.title,
        description: typeof c.description === "string" ? c.description : popup.description,
        capacity: typeof c.capacity === "number" ? c.capacity : popup.capacity,
        useWaitlist: typeof c.useWaitlist === "boolean" ? c.useWaitlist : popup.useWaitlist,
        deadline: typeof c.deadline === "string" && c.deadline ? c.deadline : (popup.deadline ?? ""),
        depositAmount: typeof c.depositAmount === "number" ? c.depositAmount : popup.depositAmount,
        applicantDbUrl: typeof c.applicantDbUrl === "string" ? c.applicantDbUrl : popup.applicantDbUrl,
        fieldSpec:
          typeof c.fieldSpec === "string" && c.fieldSpec
            ? c.fieldSpec
            : popup.fields.map((f) => `${f.name}`).join(" / "),
        rosterUrl: typeof c.rosterUrl === "string" ? c.rosterUrl : popup.rosterUrl,
        teamSlotCount: typeof c.teamSlotCount === "number" ? c.teamSlotCount : popup.teamSlotCount,
        noticeTitle: typeof c.noticeTitle === "string" ? c.noticeTitle : popup.noticeTitle,
        autoOpenHome: typeof c.autoOpenHome === "boolean" ? c.autoOpenHome : popup.autoOpenHome,
      };
      await updatePopupConfig(popup.id, input);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch (error) {
    console.error(`팝업(${slug}) 수정 실패:`, error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

// 삭제: 연결된 노션 표(신청자 명단)는 그대로 두고, 이 팝업 설정만 보관 처리합니다.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

  const { slug } = await params;
  const popup = await getPopupConfigBySlug(slug).catch(() => null);
  if (!popup) return NextResponse.json({ error: "팝업을 찾을 수 없습니다." }, { status: 404 });

  try {
    await deletePopupConfig(popup.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`팝업(${slug}) 삭제 실패:`, error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `삭제 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
