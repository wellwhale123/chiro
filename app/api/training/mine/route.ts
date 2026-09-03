import { NextRequest, NextResponse } from "next/server";
import { getMyTrainingSessions } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";

  if (!name || !studentId) {
    return NextResponse.json({ error: "이름과 학번을 모두 입력해 주세요." }, { status: 400 });
  }

  try {
    const sessions = await getMyTrainingSessions(name, studentId);
    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error("내 교육 신청 조회 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `조회 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
