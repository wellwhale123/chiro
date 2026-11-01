import type { PageObjectResponse } from "@notionhq/client";
import { notionNew as notion, getDataSourceId, isFullPage } from "@/lib/notion";
import {
  DEFAULT_ROSTER_URL,
  isPopupPeriodOver,
  type PopupConfig,
  type PopupField,
  type PopupPromotion,
} from "@/lib/dynamicPopups";

// ---- 홈커밍데이 신청 (코드로 만든 팝업) ----
// 처음에는 관리자 "팝업 생성"으로 만들었던 팝업을 코드로 옮긴 것입니다. 신청자 명단 표는
// 기존 노션 표를 그대로 쓰므로 이미 들어온 신청과 순번이 그대로 이어집니다.
// 신청/순번/명단 확인 로직은 동적 팝업 엔진(lib/dynamicPopups.ts)을 그대로 재사용하고,
// 여기에는 홈커밍 전용 설정 + 본인 취소 + 예비번호 이메일 알림만 둡니다.

// 홈커밍 신청 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_HOMECOMING_MODAL = true;

// 신청 마감 시각 (한국 시간, 예: "2026-11-07T23:59:00+09:00"). null이면 마감 없이 계속 받습니다.
// 이 시각이 지나면 SHOW_HOMECOMING_MODAL이 true여도 팝업/공지가 자동으로 숨겨지고 새 신청이 막힙니다.
export const HOMECOMING_DEADLINE: string | null = "2026-11-01T23:59:00+09:00";

// 공지사항 중, 제목이 이 값과 정확히 일치하는 항목은 클릭 시 홈커밍 신청 팝업을 엽니다.
export const HOMECOMING_NOTICE_TITLE = "홈커밍데이";

export const HOMECOMING_SLUG = "homecoming";

const HOMECOMING_DATABASE_ID = "407672e627b180ed923ae9199a44ecfb";
const HOMECOMING_CAPACITY = 30;
const HOMECOMING_CONTACT = "이상민";
const HOMECOMING_TITLE = "홈커밍데이";
const HOMECOMING_DESCRIPTION =
  "CHIRO의 최근 소식을 나누고, 선후배 간의 끈끈한 네트워킹을 이어갈 수 있는 홈커밍데이에 여러분을 초대합니다. " +
  "특히 이번 행사에는 각 관심 분야의 현업에서 활약하고 계신 선배님들과 팀을 이루어, 자유롭게 질의응답을 나눌 수 있는 특별한 시간도 마련했습니다.";

// 예비번호 신청자가 "연락 받기"를 선택했을 때 이메일을 저장하는 컬럼. 없으면 자동으로 만듭니다.
const EMAIL_PROP = "이메일";
const ADMIN_NOTIFY_EMAIL = "brightyes7@cau.ac.kr";

const HOMECOMING_APPLICANT_URL = `https://app.notion.com/p/${HOMECOMING_DATABASE_ID}`;

export function isHomecomingVisible(): boolean {
  return SHOW_HOMECOMING_MODAL && !(HOMECOMING_DEADLINE && Date.now() >= new Date(HOMECOMING_DEADLINE).getTime());
}

export function getHomecomingContact(): string {
  return HOMECOMING_CONTACT;
}

// ---- 노션 표 스키마 (관심분야 선택지는 노션 표에 있는 그대로 가져옵니다) ----

let dataSourceIdCache: string | null = null;
async function getHomecomingDataSourceId(): Promise<string> {
  if (dataSourceIdCache) return dataSourceIdCache;
  dataSourceIdCache = await getDataSourceId(HOMECOMING_DATABASE_ID, notion);
  return dataSourceIdCache;
}

type SchemaInfo = { types: Record<string, string>; interestOptions: string[] };
let schemaCache: { at: number; value: SchemaInfo } | null = null;
const SCHEMA_TTL_MS = 60 * 1000;

async function getHomecomingSchema(force = false): Promise<SchemaInfo> {
  if (!force && schemaCache && Date.now() - schemaCache.at < SCHEMA_TTL_MS) return schemaCache.value;
  const dataSource = await notion.dataSources.retrieve({ data_source_id: await getHomecomingDataSourceId() });
  const types: Record<string, string> = {};
  let interestOptions: string[] = [];
  if ("properties" in dataSource) {
    for (const [name, config] of Object.entries(dataSource.properties)) {
      types[name] = config.type;
      if (name === "관심분야" && config.type === "select") {
        interestOptions = config.select.options.map((o) => o.name);
      }
    }
  }
  const value = { types, interestOptions };
  schemaCache = { at: Date.now(), value };
  return value;
}

export async function getHomecomingPopup(): Promise<PopupConfig> {
  const schema = await getHomecomingSchema();
  const fields: PopupField[] = [
    { name: "관심분야", type: "select", options: schema.interestOptions },
    { name: "질문사항", type: "rich_text" },
  ];
  return {
    id: `code-${HOMECOMING_SLUG}`,
    title: HOMECOMING_TITLE,
    description: HOMECOMING_DESCRIPTION,
    capacity: HOMECOMING_CAPACITY,
    useWaitlist: true,
    startAt: null,
    deadline: HOMECOMING_DEADLINE,
    depositAmount: null,
    applicantDbUrl: HOMECOMING_APPLICANT_URL,
    fields,
    rosterUrl: DEFAULT_ROSTER_URL,
    teamSlotCount: null,
    cancelManager: HOMECOMING_CONTACT,
    noticeTitle: HOMECOMING_NOTICE_TITLE,
    autoOpenHome: true,
    checkRoster: true,
    status: SHOW_HOMECOMING_MODAL ? "활성" : "일시중지",
    slug: HOMECOMING_SLUG,
  };
}

export function isHomecomingClosed(popup: PopupConfig): boolean {
  return popup.status !== "활성" || isPopupPeriodOver(popup);
}

// ---- 예비번호 이메일 ----

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureEmailColumn(): Promise<void> {
  const schema = await getHomecomingSchema();
  if (schema.types[EMAIL_PROP]) return;
  await notion.dataSources.update({
    data_source_id: await getHomecomingDataSourceId(),
    properties: { [EMAIL_PROP]: { email: {} } },
  });
  await getHomecomingSchema(true);
}

function getRowStudentId(page: PageObjectResponse): string {
  const prop = page.properties["학번"];
  if (prop?.type === "number") return prop.number !== null ? String(prop.number) : "";
  if (prop?.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  return "";
}

function getRowEmail(page: PageObjectResponse): string {
  const prop = page.properties[EMAIL_PROP];
  if (prop?.type === "email") return prop.email ?? "";
  if (prop?.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  return "";
}

// 신청 직후, 학번으로 방금 저장된 줄을 찾아 이메일을 기록합니다.
export async function saveHomecomingEmail(studentId: string, email: string): Promise<void> {
  await ensureEmailColumn();
  const schema = await getHomecomingSchema();
  const response = await notion.dataSources.query({
    data_source_id: await getHomecomingDataSourceId(),
    filter:
      schema.types["학번"] === "number"
        ? { property: "학번", number: { equals: Number(studentId) } }
        : { property: "학번", rich_text: { equals: studentId } },
  });
  const page = response.results.filter(isFullPage).find((p) => getRowStudentId(p) === studentId);
  if (!page) throw new Error("방금 저장된 신청을 찾지 못해 이메일을 기록하지 못했습니다.");
  const value =
    schema.types[EMAIL_PROP] === "rich_text"
      ? { type: "rich_text" as const, rich_text: [{ type: "text" as const, text: { content: email } }] }
      : { type: "email" as const, email };
  await notion.pages.update({ page_id: page.id, properties: { [EMAIL_PROP]: value } });
}

// 취소로 예비번호에서 확정으로 올라온 사람에게 메일을 보냅니다. 이메일을 남기지 않았으면
// 관리자에게만 알려서 직접 연락할 수 있게 합니다. 메일 실패는 취소 처리에 영향을 주지 않습니다.
export async function notifyHomecomingPromotions(promoted: PopupPromotion[]): Promise<void> {
  if (promoted.length === 0) return;
  const { sendMail } = await import("./mailer");

  for (const p of promoted) {
    try {
      const page = await notion.pages.retrieve({ page_id: p.id });
      const email = isFullPage(page) ? getRowEmail(page) : "";

      if (email) {
        await sendMail({
          to: email,
          bcc: ADMIN_NOTIFY_EMAIL,
          subject: `[CHIRO] ${HOMECOMING_TITLE} 신청이 확정되었습니다`,
          html: `
            <div style="font-family: sans-serif; line-height: 1.6;">
              <p>${p.name}님, 안녕하세요. CHIRO입니다.</p>
              <p>예비번호로 대기하셨던 <strong>${HOMECOMING_TITLE}</strong> 신청에 자리가 생겨
              <strong>확정 순번 ${p.rank}번째</strong>로 변경되었습니다.</p>
              <p>참석이 어려우시면 홈페이지 홈커밍데이 신청 팝업의 "신청 취소"에서 이름과 학번으로 취소해 주세요.
              문의는 ${HOMECOMING_CONTACT}에게 부탁드립니다.</p>
            </div>
          `,
        });
      } else {
        await sendMail({
          to: ADMIN_NOTIFY_EMAIL,
          subject: `[CHIRO] ${HOMECOMING_TITLE} 예비 → 확정 (연락처 없음): ${p.name}`,
          html: `
            <div style="font-family: sans-serif; line-height: 1.6;">
              <p>취소로 자리가 생겨 <strong>${p.name} (${p.studentId})</strong>님이 확정 순번 ${p.rank}번째가 되었습니다.</p>
              <p>이 신청자는 이메일을 남기지 않아 자동 안내가 발송되지 않았습니다. 직접 연락해 주세요.</p>
            </div>
          `,
        });
      }
    } catch (error) {
      console.error(`홈커밍 확정 안내 메일 발송 실패 (${p.name} ${p.studentId}):`, error);
    }
  }
}
