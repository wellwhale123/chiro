import { DEFAULT_ROSTER_URL, isPopupNotStartedYet, isPopupPeriodOver, type PopupConfig } from "@/lib/dynamicPopups";
import {
  ROBOTHON_DEPOSIT_AMOUNT,
  ROBOTHON_TEAM_CAPACITY,
  ROBOTHON_TEAMMATE_SLOTS,
  ROBOTHON_TEAMS,
} from "@/lib/robothonShared";

// ---- 현대모비스 로보톤 대회 신청 (코드로 만든 팝업) ----
// 신청/순번/명단 확인 로직은 동적 팝업 엔진(lib/dynamicPopups.ts)을 재사용합니다.
// 이 팝업만의 규칙: 팀(비전/키네마틱스) 택1, 팀원 희망 1명, 입금 1만원, 동의서 동의 + 서명 필수,
// 재신청하면 신청 순위가 맨 뒤로 밀림.

// 로보톤 신청 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_ROBOTHON_MODAL = true;

// 신청 시작 시각 (한국 시간). 이 시각 전에는 팝업/공지가 숨겨지고 신청도 막힙니다. null이면 바로 시작.
export const ROBOTHON_START: string | null = "2026-11-01T17:00:00+09:00";

// 신청 마감 시각 (한국 시간, 예: "2026-11-07T23:59:00+09:00"). null이면 내릴 때까지 계속 받습니다.
export const ROBOTHON_DEADLINE: string | null = null;

// 공지사항 중, 제목이 이 값과 정확히 일치하는 항목은 클릭 시 로보톤 신청 팝업을 엽니다.
export const ROBOTHON_NOTICE_TITLE = "로보톤 신청";

// 팀별 정원은 lib/robothonShared.ts의 ROBOTHON_TEAM_CAPACITY에서 정합니다.


const ROBOTHON_DATABASE_ID = "40b672e627b18042a014f29f00bf3b9c";

export function isRobothonVisible(): boolean {
  const now = Date.now();
  if (ROBOTHON_START && now < new Date(ROBOTHON_START).getTime()) return false;
  return SHOW_ROBOTHON_MODAL && !(ROBOTHON_DEADLINE && now >= new Date(ROBOTHON_DEADLINE).getTime());
}

export function getRobothonPopup(): PopupConfig {
  return {
    id: "code-robothon",
    title: "현대모비스 로보톤 신청",
    description: "CHIRO × 현대모비스 로보톤 참가 신청입니다. 아래 동의서를 읽고 서명한 뒤 신청해 주세요.",
    capacity: null,
    useWaitlist: true,
    startAt: ROBOTHON_START,
    deadline: ROBOTHON_DEADLINE,
    depositAmount: ROBOTHON_DEPOSIT_AMOUNT,
    applicantDbUrl: `https://app.notion.com/p/${ROBOTHON_DATABASE_ID}`,
    fields: [{ name: "팀", type: "select", options: ROBOTHON_TEAMS }],
    rosterUrl: DEFAULT_ROSTER_URL,
    teamSlotCount: ROBOTHON_TEAMMATE_SLOTS,
    cancelManager: "옥소이",
    noticeTitle: ROBOTHON_NOTICE_TITLE,
    autoOpenHome: true,
    checkRoster: true,
    status: SHOW_ROBOTHON_MODAL ? "활성" : "일시중지",
    slug: "robothon",
    reapplyToBack: true,
    groupBy: "팀",
    groupCapacity: ROBOTHON_TEAM_CAPACITY,
  };
}

export function isRobothonClosed(popup: PopupConfig): boolean {
  return popup.status !== "활성" || isPopupNotStartedYet(popup) || isPopupPeriodOver(popup);
}
