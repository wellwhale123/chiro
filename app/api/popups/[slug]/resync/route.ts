import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";
import { getPopupConfigBySlug, resyncAllPopupRanks } from "@/lib/dynamicPopups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const { slug } = await params;
  try {
    const popup = await getPopupConfigBySlug(slug);
    if (!popup) return NextResponse.json({ error: "팝업을 찾을 수 없습니다." }, { status: 404 });

    await resyncAllPopupRanks(popup);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`팝업(${slug}) 순번 재정리 실패:`, error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `재정리 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
