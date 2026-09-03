import { NextRequest, NextResponse } from "next/server";
import {
  getTrainingSlotCounts,
  submitTrainingSelection,
  isClubMember,
  TRAINING_CAPACITY_PER_SLOT,
  TRAINING_SLOTS,
} from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidSlot(type: "printer" | "solder", date: string, time: string): boolean {
  return TRAINING_SLOTS[type].some((s) => s.date === date && s.time === time);
}

// 각 슬롯의 현재 신청 인원을 내려줍니다.
export async function GET() {
  try {
    const counts = await getTrainingSlotCounts();
    return NextResponse.json({ success: true, capacity: TRAINING_CAPACITY_PER_SLOT, counts });
  } catch (error) {
    console.error("교육 신청 현황 조회 실패:", error);
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
  const printer = body?.printer && typeof body.printer === "object" ? body.printer : null;
  const solder = body?.solder && typeof body.solder === "object" ? body.solder : null;

  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!studentId) {
    return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  }
  if (!printer && !solder) {
    return NextResponse.json(
      { error: "프린터기 / 인두기 교육 중 최소 하나는 선택해 주세요." },
      { status: 400 }
    );
  }
  if (printer && !isValidSlot("printer", printer.date, printer.time)) {
    return NextResponse.json({ error: "프린터기 교육 시간이 올바르지 않습니다." }, { status: 400 });
  }
  if (solder && !isValidSlot("solder", solder.date, solder.time)) {
    return NextResponse.json({ error: "인두기 교육 시간이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const isMember = await isClubMember(name, studentId);
    if (!isMember) {
      return NextResponse.json(
        { error: "동아리원 명단에서 이름과 학번을 확인할 수 없어요. 외부인은 신청할 수 없습니다." },
        { status: 403 }
      );
    }

    const result = await submitTrainingSelection(
      name,
      studentId,
      printer ? { date: printer.date, time: printer.time } : null,
      solder ? { date: solder.date, time: solder.time } : null
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("교육 신청 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: detail || "신청 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
