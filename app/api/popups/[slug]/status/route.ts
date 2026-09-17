import { NextRequest, NextResponse } from "next/server";
import { getPopupConfigBySlug, getPopupStatus } from "@/lib/dynamicPopups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";

  if (!name || !studentId) {
    return NextResponse.json({ error: "이름과 학번을 모두 입력해 주세요." }, { status: 400 });
  }

  try {
    const popup = await getPopupConfigBySlug(slug);
    if (!popup) return NextResponse.json({ error: "팝업을 찾을 수 없습니다." }, { status: 404 });

    const status = await getPopupStatus(popup, name, studentId);
    if (!status.found) {
      return NextResponse.json(
        { error: "일치하는 신청 내역을 찾을 수 없어요. 이름과 학번을 다시 확인해 주세요." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, result: status.result });
  } catch (error) {
    console.error(`팝업(${slug}) 상태 조회 실패:`, error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `조회 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
