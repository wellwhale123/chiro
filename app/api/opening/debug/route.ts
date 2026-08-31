import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";
import { getOpeningRegistrations, AFTER_PARTY1_CAPACITY } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 임시 디버그용: 뒷풀이 1차 신청자 전체를 순번과 함께 그대로 보여줍니다 (관리자 로그인 필요).
// 원인 파악되면 이 라우트는 삭제할 예정입니다.
export async function GET() {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자만 볼 수 있어요." }, { status: 403 });
  }

  const all = await getOpeningRegistrations();
  const afterParty1 = all
    .filter((r) => r.events.afterParty1)
    .sort((a, b) => new Date(a.logTime).getTime() - new Date(b.logTime).getTime())
    .map((r, i) => ({
      rank: i + 1,
      status: i + 1 <= AFTER_PARTY1_CAPACITY ? "confirmed" : "waitlisted",
      name: r.name,
      studentId: r.studentId,
      logTime: r.logTime,
      waitlistEmail: r.waitlistEmail || null,
      waitlistNotified: r.waitlistNotified,
    }));

  return NextResponse.json({
    capacity: AFTER_PARTY1_CAPACITY,
    totalAfterParty1: afterParty1.length,
    totalAllRegistrations: all.length,
    afterParty1,
  });
}
