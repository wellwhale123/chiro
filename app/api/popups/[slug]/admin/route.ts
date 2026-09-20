import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin";
import {
  getPopupConfigBySlug,
  setPopupStatus,
  deletePopupConfig,
  updatePopupConfig,
  formatFieldSpec,
  type PopupConfigInput,
} from "@/lib/dynamicPopups";

// 홈페이지/공지사항은 60초 캐시라, 관리자 변경(생성/수정/상태변경/삭제) 직후
// 바로 반영되도록 캐시를 갱신합니다.
function revalidatePopupPages() {
  revalidatePath("/");
  revalidatePath("/notices");
}

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
      revalidatePopupPages();
      return NextResponse.json({ success: true });
    }

    if (body.config && typeof body.config === "object") {
      const c = body.config as Record<string, unknown>;
      const input: PopupConfigInput = {
        title: typeof c.title === "string" ? c.title.trim() : popup.title,
        description: typeof c.description === "string" ? c.description : popup.description,
        capacity: typeof c.capacity === "number" ? c.capacity : popup.capacity,
        useWaitlist: typeof c.useWaitlist === "boolean" ? c.useWaitlist : popup.useWaitlist,
        // 빈 문자열은 "시작 제한 없음"이라는 유효한 값이므로, string 타입이기만 하면 그대로 씁니다.
        // c.startAt이 아예 안 왔을 때만 기존 값으로 되돌립니다.
        startAt: typeof c.startAt === "string" ? c.startAt : (popup.startAt ?? ""),
        deadline: typeof c.deadline === "string" && c.deadline ? c.deadline : (popup.deadline ?? ""),
        depositAmount: typeof c.depositAmount === "number" ? c.depositAmount : popup.depositAmount,
        applicantDbUrl: typeof c.applicantDbUrl === "string" ? c.applicantDbUrl : popup.applicantDbUrl,
        // 빈 문자열("추가 필드 없음")도 유효한 값이므로, string 타입이기만 하면 그대로 씁니다.
        // c.fieldSpec이 아예 안 왔을 때만 기존 필드 구성으로 되돌립니다 (formatFieldSpec으로
        // 타입 정보까지 복원 — 예전처럼 이름만 이어붙이면 타입이 사라져 재파싱이 깨집니다).
        fieldSpec: typeof c.fieldSpec === "string" ? c.fieldSpec : formatFieldSpec(popup.fields),
        rosterUrl: typeof c.rosterUrl === "string" ? c.rosterUrl : popup.rosterUrl,
        teamSlotCount: typeof c.teamSlotCount === "number" ? c.teamSlotCount : popup.teamSlotCount,
        noticeTitle: typeof c.noticeTitle === "string" ? c.noticeTitle : popup.noticeTitle,
        autoOpenHome: typeof c.autoOpenHome === "boolean" ? c.autoOpenHome : popup.autoOpenHome,
        cancelManager: typeof c.cancelManager === "string" ? c.cancelManager : popup.cancelManager,
        checkRoster: typeof c.checkRoster === "boolean" ? c.checkRoster : popup.checkRoster,
      };
      await updatePopupConfig(popup.id, input);
      revalidatePopupPages();
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
    revalidatePopupPages();
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
