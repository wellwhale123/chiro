import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";
import { resyncAllIrcRanks } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 관리자 로그인 상태에서 이 주소로 접속하면, IRC 신청 순위를 처음부터 다시 계산해서 노션에 다시 씁니다.
export async function GET() {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자만 사용할 수 있어요." }, { status: 403 });
  }

  try {
    await resyncAllIrcRanks();
    return NextResponse.json({ success: true, message: "신청 순위를 다시 정리했습니다." });
  } catch (error) {
    console.error("IRC 순위 재정리 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `재정리 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
