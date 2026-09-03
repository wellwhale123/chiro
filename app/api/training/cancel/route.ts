import { NextRequest, NextResponse } from "next/server";
import { cancelTrainingSession } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
  const type = body?.type === "printer" || body?.type === "solder" ? body.type : null;

  if (!name || !studentId || !type) {
    return NextResponse.json({ error: "이름, 학번, 취소할 교육 종류를 확인해 주세요." }, { status: 400 });
  }

  try {
    const found = await cancelTrainingSession(name, studentId, type);
    if (!found) {
      return NextResponse.json(
        { error: "일치하는 신청 내역을 찾을 수 없어요. 이름과 학번을 다시 확인해 주세요." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("교육 신청 취소 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `취소 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
