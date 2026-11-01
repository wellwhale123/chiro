import { NextRequest, NextResponse } from "next/server";
import {
  getPopupGroupStats,
  submitPopupRegistration,
  findRosterMember,
  resyncPopupRanksThrottled,
} from "@/lib/dynamicPopups";
import { getRobothonPopup, isRobothonClosed } from "@/lib/robothon";
import { ROBOTHON_SIGNATURE_PROP, ROBOTHON_TEAMMATE_SLOTS, ROBOTHON_TEAMS } from "@/lib/robothonShared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function GET() {
  try {
    const popup = getRobothonPopup();
    await resyncPopupRanksThrottled(popup).catch((error) => {
      console.error("로보톤 순번 자동 재정렬 실패:", error);
    });
    const groups = await getPopupGroupStats(popup);
    const teams = ROBOTHON_TEAMS.map((name) => {
      const g = groups[name];
      const capacity = g?.capacity ?? null;
      const confirmedCount = g?.confirmedCount ?? 0;
      return {
        name,
        capacity,
        remaining: capacity === null ? null : Math.max(0, capacity - confirmedCount),
        waitingCount: g?.waitingCount ?? 0,
      };
    });
    return NextResponse.json({ success: true, periodOver: isRobothonClosed(popup), teams });
  } catch (error) {
    console.error("로보톤 현황 조회 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `현황을 불러오지 못했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

function asFile(value: FormDataEntryValue | null): File | undefined {
  return value instanceof File && value.size > 0 ? value : undefined;
}

export async function POST(request: NextRequest) {
  const popup = getRobothonPopup();
  if (isRobothonClosed(popup)) {
    return NextResponse.json({ error: "신청 기간이 아닙니다." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v.trim() : "";
  };
  const name = str("name");
  const studentId = str("studentId");
  const team = str("team");
  const teammateNames = Array.from({ length: ROBOTHON_TEAMMATE_SLOTS }, (_, i) => str(`teammate${i + 1}`)).filter(Boolean);
  const agreed = str("agree") === "true";
  const signatureFile = asFile(form.get("signatureFile"));
  const paymentFile = asFile(form.get("paymentFile"));

  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  if (!studentId) return NextResponse.json({ error: "학번을 입력해 주세요." }, { status: 400 });
  if (!ROBOTHON_TEAMS.includes(team)) {
    return NextResponse.json({ error: "팀을 선택해 주세요." }, { status: 400 });
  }
  if (!agreed) return NextResponse.json({ error: "동의서에 동의해 주세요." }, { status: 400 });
  if (!signatureFile) return NextResponse.json({ error: "동의서에 서명해 주세요." }, { status: 400 });
  if (signatureFile.type !== "image/png" || signatureFile.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "서명 이미지를 다시 그려 주세요." }, { status: 400 });
  }

  try {
    const rosterMatch = await findRosterMember(popup.rosterUrl, name, studentId);
    if (!rosterMatch) {
      return NextResponse.json(
        { error: "동아리원 명단에서 이름과 학번을 확인할 수 없어요. 외부인은 신청할 수 없습니다." },
        { status: 403 }
      );
    }
    const extra: Record<string, string | boolean> = { 팀: team };
    if (rosterMatch.department) extra["학과"] = rosterMatch.department;
    if (rosterMatch.year) extra["학년"] = rosterMatch.year;

    // 선택한 팀의 정원이 이미 찼으면 예비번호가 되므로 입금을 받지 않습니다(튜터링과 동일).
    const teamStats = (await getPopupGroupStats(popup))[team];
    const willBeConfirmed = !teamStats?.capacity || teamStats.confirmedCount < teamStats.capacity;
    if (willBeConfirmed) {
      if (!paymentFile) {
        return NextResponse.json({ error: "입금 확인 스크린샷을 첨부해 주세요." }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.includes(paymentFile.type)) {
        return NextResponse.json({ error: "입금 확인 사진은 이미지 파일만 가능합니다." }, { status: 400 });
      }
      if (paymentFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "입금 확인 사진은 8MB 이하로 올려주세요." }, { status: 400 });
      }
    }

    const { updated, result } = await submitPopupRegistration(popup, {
      name,
      studentId,
      teammateNames,
      paymentFile: willBeConfirmed ? paymentFile : undefined,
      extra,
      extraFiles: { [ROBOTHON_SIGNATURE_PROP]: signatureFile },
    });
    if (result.status === "full") {
      return NextResponse.json({ error: "정원이 마감되었습니다." }, { status: 409 });
    }
    return NextResponse.json({ success: true, reapplied: updated, result });
  } catch (error) {
    console.error("로보톤 신청 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `신청 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
