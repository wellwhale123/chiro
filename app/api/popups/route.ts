import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin";
import {
  getAllPopupConfigs,
  getVisiblePopupConfigs,
  createPopupConfig,
  type PopupConfigInput,
} from "@/lib/dynamicPopups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 공개 조회: 홈페이지/공지사항에 노출할, 활성 상태이고 마감 전인 팝업만.
// 관리자 세션이면(?all=1) 일시중지/마감된 것까지 전부 돌려줍니다 (관리자 목록 화면용).
export async function GET(request: NextRequest) {
  try {
    const wantsAll = request.nextUrl.searchParams.get("all") === "1";
    if (wantsAll) {
      const isAdmin = await isAdminSession();
      if (!isAdmin) {
        return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
      }
      const popups = await getAllPopupConfigs();
      return NextResponse.json({ success: true, popups });
    }

    const popups = await getVisiblePopupConfigs();
    return NextResponse.json({ success: true, popups });
  } catch (error) {
    console.error("팝업 목록 조회 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `팝업 목록을 불러오지 못했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const applicantDbUrl = typeof body.applicantDbUrl === "string" ? body.applicantDbUrl.trim() : "";
  const fieldSpec = typeof body.fieldSpec === "string" ? body.fieldSpec.trim() : "";
  const deadline = typeof body.deadline === "string" ? body.deadline.trim() : "";

  if (!title) return NextResponse.json({ error: "팝업 제목을 입력해 주세요." }, { status: 400 });
  if (!applicantDbUrl) {
    return NextResponse.json({ error: "연결된 노션 표 링크를 입력해 주세요." }, { status: 400 });
  }
  if (!deadline) {
    return NextResponse.json({ error: "마감 일시를 입력해 주세요." }, { status: 400 });
  }

  const input: PopupConfigInput = {
    title,
    description: typeof body.description === "string" ? body.description : "",
    capacity: typeof body.capacity === "number" ? body.capacity : null,
    useWaitlist: Boolean(body.useWaitlist),
    deadline,
    depositAmount: typeof body.depositAmount === "number" ? body.depositAmount : null,
    applicantDbUrl,
    fieldSpec,
    rosterUrl: typeof body.rosterUrl === "string" && body.rosterUrl.trim() ? body.rosterUrl.trim() : undefined,
    teamSlotCount: typeof body.teamSlotCount === "number" ? body.teamSlotCount : null,
    noticeTitle: typeof body.noticeTitle === "string" && body.noticeTitle.trim() ? body.noticeTitle.trim() : undefined,
    autoOpenHome: Boolean(body.autoOpenHome),
    cancelManager: typeof body.cancelManager === "string" ? body.cancelManager.trim() : undefined,
  };

  try {
    const id = await createPopupConfig(input);
    // 홈페이지/공지사항은 60초 캐시라, 생성 즉시 노출되도록 캐시를 바로 갱신합니다.
    revalidatePath("/");
    revalidatePath("/notices");
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("팝업 생성 실패:", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
