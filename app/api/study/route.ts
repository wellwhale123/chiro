import { NextRequest, NextResponse } from "next/server";
import { getStudyStats, submitStudyRegistration, isClubMember, STUDY_CAPACITY_BY_PROGRAM } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const stats = await getStudyStats();
    return NextResponse.json({ success: true, capacity: STUDY_CAPACITY_BY_PROGRAM, stats });
  } catch (error) {
    console.error("스터디 현황 조회 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `현황을 불러오지 못했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
  const arduino = body?.arduino === true;
  const cad = body?.cad === true;

  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!studentId) {
    return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  }
  if (!arduino && !cad) {
    return NextResponse.json({ error: "아두이노 / CAD 중 최소 하나는 선택해 주세요." }, { status: 400 });
  }

  try {
    const isMember = await isClubMember(name, studentId);
    if (!isMember) {
      return NextResponse.json(
        { error: "동아리원 명단에서 이름과 학번을 확인할 수 없어요. 외부인은 신청할 수 없습니다." },
        { status: 403 }
      );
    }

    const result = await submitStudyRegistration(name, studentId, arduino, cad);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("스터디 신청 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
