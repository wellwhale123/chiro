import type { PageObjectResponse } from "@notionhq/client";
import { notion, isFullPage, getDataSourceId, getTitleText, getRichText } from "@/lib/notion";

// ---- 동적 팝업 생성 시스템 ----
// 관리자 모드에서 만든 "OOO 신청" 팝업들의 설정을 저장하는 마스터 노션 데이터베이스와,
// 각 팝업의 신청자 명단(관리자가 직접 만들어 연결한 노션 표)을 다루는 공용 엔진입니다.
// 기존에 하드코딩되어 있던 개강총회/교육/튜터링/MT/스터디/IRC 팝업과는 별개의 시스템입니다.

const MASTER_DATA_SOURCE_ID = "fb8f4a52-857a-4fe6-8018-08225c57179f";

export const DEPOSIT_ACCOUNT_INFO = "토스뱅크 1002-4084-6167 (예금주: 옥소이)";
const DEFAULT_CANCEL_MANAGER = "옥소이";

// 동아리 전체 부원 통합 명단 (신규등록+재등록을 합친 표). 명단 검증은 항상 이 DB를 기본으로 사용합니다.
const DEFAULT_ROSTER_DATABASE_ID = "3de474b8fa7e802ea3efc0e561b81ef1";
const DEFAULT_ROSTER_URL = `https://app.notion.com/p/${DEFAULT_ROSTER_DATABASE_ID}`;
const DEFAULT_ROSTER_STUDENT_ID_PROP = "Column 5";

// 모든 팝업의 신청자 명단 표는 이 7개 표준 컬럼을 항상 갖추고 있다고 가정합니다
// (관리자가 표를 만들 때마다 직접 추가). "신청 표 필드 구성"에는 이 7개 외에 추가로
// 필요한 필드만 적으면 됩니다.
const STANDARD_FIELDS = {
  name: "이름",
  studentId: "학번",
  department: "학과",
  year: "학년",
  payment: "입금확인",
  teammates: "팀원희망",
  rank: "신청순위",
} as const;

type PagePropertiesInput = NonNullable<
  Parameters<typeof notion.pages.update>[0]["properties"]
>;
type PagePropertyValueInput = PagePropertiesInput[string];

// ---- 필드 구성 문자열 파싱 ("이름(타이틀) / 학번(숫자) / 입금내역(파일)") ----

export type PopupFieldType = "title" | "rich_text" | "number" | "files" | "checkbox" | "date" | "select";
export type PopupField = { name: string; type: PopupFieldType; options?: string[] };

const FIELD_TYPE_LABELS: Record<string, PopupFieldType> = {
  "타이틀": "title",
  "텍스트": "rich_text",
  "숫자": "number",
  "파일": "files",
  "체크박스": "checkbox",
  "날짜": "date",
};

export function parseFieldSpec(spec: string): PopupField[] {
  return spec
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.+?)\(([^)]+)\)$/);
      if (!match) {
        throw new Error(`필드 형식을 이해할 수 없습니다: "${entry}" (예: 이름(타이틀))`);
      }
      const name = match[1].trim();
      const typeSpec = match[2].trim();
      if (typeSpec.startsWith("리스트")) {
        const options = (typeSpec.split(":")[1] ?? "")
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
        return { name, type: "select" as const, options };
      }
      const type = FIELD_TYPE_LABELS[typeSpec];
      if (!type) {
        throw new Error(
          `알 수 없는 필드 타입입니다: "${typeSpec}" (타이틀/텍스트/숫자/파일/체크박스/날짜/리스트:옵션1,옵션2 중 하나여야 합니다)`
        );
      }
      return { name, type };
    });
}

export function formatFieldSpec(fields: PopupField[]): string {
  return fields
    .map((f) => {
      if (f.type === "select") return `${f.name}(리스트:${(f.options ?? []).join(",")})`;
      const label = Object.entries(FIELD_TYPE_LABELS).find(([, t]) => t === f.type)?.[0] ?? f.type;
      return `${f.name}(${label})`;
    })
    .join(" / ");
}

function extractDatabaseId(url: string): string {
  const match = url.match(/[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (!match) throw new Error(`노션 링크에서 데이터베이스 ID를 찾을 수 없습니다: ${url}`);
  return match[0].replace(/-/g, "");
}

function getUrlProp(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  return prop?.type === "url" ? prop.url ?? "" : "";
}

// ---- 팝업 설정 (마스터 DB) ----

export type PopupConfig = {
  id: string;
  title: string;
  description: string;
  capacity: number | null;
  useWaitlist: boolean;
  deadline: string | null;
  depositAmount: number | null;
  applicantDbUrl: string;
  fields: PopupField[];
  rosterUrl: string;
  teamSlotCount: number | null;
  cancelManager: string;
  noticeTitle: string;
  autoOpenHome: boolean;
  status: "활성" | "일시중지";
  slug: string;
};

export function isPopupPeriodOver(popup: PopupConfig): boolean {
  return Boolean(popup.deadline) && Date.now() >= new Date(popup.deadline as string).getTime();
}

function parsePopupPage(page: PageObjectResponse): PopupConfig {
  const title = getTitleText(page, "팝업 제목");
  const description = getRichText(page, "안내 문구");

  const capacityProp = page.properties["정원"];
  const capacity = capacityProp?.type === "number" ? capacityProp.number : null;

  const waitlistProp = page.properties["예비번호 사용"];
  const useWaitlist = waitlistProp?.type === "checkbox" ? waitlistProp.checkbox : false;

  const deadlineProp = page.properties["마감 일시"];
  const deadline = deadlineProp?.type === "date" ? deadlineProp.date?.start ?? null : null;

  const depositProp = page.properties["입금 금액"];
  const depositAmount = depositProp?.type === "number" ? depositProp.number : null;

  const applicantDbUrl = getUrlProp(page, "연결된 노션 표 링크");
  const fieldSpec = getRichText(page, "신청 표 필드 구성");

  const rosterUrlRaw = getUrlProp(page, "명단 DB 링크");

  const teamSlotProp = page.properties["팀원 희망 칸 수"];
  const teamSlotCount = teamSlotProp?.type === "number" ? teamSlotProp.number : null;

  const cancelManagerRaw = getRichText(page, "취소 담당자");
  const noticeTitleRaw = getRichText(page, "공지 제목");

  const autoOpenProp = page.properties["홈페이지 자동 팝업"];
  const autoOpenHome = autoOpenProp?.type === "checkbox" ? autoOpenProp.checkbox : false;

  const statusProp = page.properties["상태"];
  const status: "활성" | "일시중지" =
    statusProp?.type === "select" && statusProp.select?.name === "일시중지" ? "일시중지" : "활성";

  const slug = getRichText(page, "slug") || title;

  let fields: PopupField[] = [];
  try {
    fields = fieldSpec ? parseFieldSpec(fieldSpec) : [];
  } catch {
    fields = [];
  }

  return {
    id: page.id,
    title,
    description,
    capacity,
    useWaitlist,
    deadline,
    depositAmount,
    applicantDbUrl,
    fields,
    rosterUrl: rosterUrlRaw || DEFAULT_ROSTER_URL,
    teamSlotCount,
    cancelManager: cancelManagerRaw || (depositAmount ? DEFAULT_CANCEL_MANAGER : ""),
    noticeTitle: noticeTitleRaw || title,
    autoOpenHome,
    status,
    slug,
  };
}

export async function getAllPopupConfigs(): Promise<PopupConfig[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const response = await notion.dataSources.query({
      data_source_id: MASTER_DATA_SOURCE_ID,
      start_cursor: cursor,
    });
    pages.push(...response.results.filter(isFullPage));
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages.map(parsePopupPage).filter((p) => p.title.trim() !== "");
}

// 홈페이지/공지사항에 노출해야 하는 팝업들: 활성 상태이고, 마감 전인 것만.
export async function getVisiblePopupConfigs(): Promise<PopupConfig[]> {
  const all = await getAllPopupConfigs();
  return all.filter((p) => p.status === "활성" && !isPopupPeriodOver(p));
}

export async function getPopupConfigBySlug(slug: string): Promise<PopupConfig | null> {
  const all = await getAllPopupConfigs();
  return all.find((p) => p.slug === slug) ?? null;
}

// ---- 명단 검증 ----

const rosterDataSourceCache = new Map<string, string>();

async function getRosterDataSourceId(rosterUrl: string): Promise<{ dataSourceId: string; databaseId: string }> {
  const databaseId = extractDatabaseId(rosterUrl);
  const cached = rosterDataSourceCache.get(databaseId);
  if (cached) return { dataSourceId: cached, databaseId };
  const dataSourceId = await getDataSourceId(databaseId);
  rosterDataSourceCache.set(databaseId, dataSourceId);
  return { dataSourceId, databaseId };
}

export type RosterMatch = { department: string; year: string };

// 기본 통합 명단은 학과/학년 컬럼 이름이 구글폼 임포트 특성상 "Column 4"/"Column 6"으로 되어 있습니다.
const DEFAULT_ROSTER_DEPARTMENT_PROP = "Column 4";
const DEFAULT_ROSTER_YEAR_PROP = "Column 6";

// 이름/학번이 둘 다 정확히 일치하는 부원을 명단에서 찾습니다. 없으면 null.
// 기본 통합 명단인 경우, 그 사람의 학과/학년도 같이 돌려줍니다 (신규 팝업 자동 기입용).
export async function findRosterMember(
  rosterUrl: string,
  name: string,
  studentId: string
): Promise<RosterMatch | null> {
  const { dataSourceId, databaseId } = await getRosterDataSourceId(rosterUrl);
  // 기본 통합 명단은 학번 속성명이 구글폼 임포트 특성상 "Column 5"로 되어 있습니다.
  // 그 외(관리자가 직접 지정한) 명단은 "학번" 속성명을 기본으로 사용합니다.
  const studentIdProp = databaseId === DEFAULT_ROSTER_DATABASE_ID ? DEFAULT_ROSTER_STUDENT_ID_PROP : "학번";
  const isDefaultRoster = databaseId === DEFAULT_ROSTER_DATABASE_ID;

  let cursor: string | undefined;
  do {
    const response = await notion.dataSources.query({ data_source_id: dataSourceId, start_cursor: cursor });
    const pages = response.results.filter(isFullPage);
    for (const page of pages) {
      const rowName = getTitleText(page, "이름").trim();
      const idProp = page.properties[studentIdProp];
      let rowStudentId = "";
      if (idProp?.type === "number" && idProp.number !== null) rowStudentId = String(idProp.number);
      else if (idProp?.type === "rich_text") rowStudentId = idProp.rich_text.map((t) => t.plain_text).join("").trim();
      if (rowName === name.trim() && rowStudentId === studentId.trim()) {
        if (!isDefaultRoster) return { department: "", year: "" };
        const deptProp = page.properties[DEFAULT_ROSTER_DEPARTMENT_PROP];
        const yearProp = page.properties[DEFAULT_ROSTER_YEAR_PROP];
        const department = deptProp?.type === "rich_text" ? deptProp.rich_text.map((t) => t.plain_text).join("").trim() : "";
        const year = yearProp?.type === "select" ? yearProp.select?.name ?? "" : "";
        return { department, year };
      }
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return null;
}

// ---- 신청자 명단 (팝업마다 별도 노션 표) ----

const applicantDataSourceCache = new Map<string, string>();
const applicantSchemaCache = new Map<string, Record<string, string>>();

async function getApplicantDataSourceId(popup: PopupConfig): Promise<string> {
  const databaseId = extractDatabaseId(popup.applicantDbUrl);
  const cached = applicantDataSourceCache.get(databaseId);
  if (cached) return cached;
  const dataSourceId = await getDataSourceId(databaseId);
  applicantDataSourceCache.set(databaseId, dataSourceId);
  return dataSourceId;
}

async function getApplicantSchema(popup: PopupConfig): Promise<Record<string, string>> {
  const databaseId = extractDatabaseId(popup.applicantDbUrl);
  const cached = applicantSchemaCache.get(databaseId);
  if (cached) return cached;
  const dataSourceId = await getApplicantDataSourceId(popup);
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const schema: Record<string, string> = {};
  if ("properties" in dataSource) {
    for (const [name, config] of Object.entries(dataSource.properties)) schema[name] = config.type;
  }
  applicantSchemaCache.set(databaseId, schema);
  return schema;
}

export type PopupRegistration = { id: string; name: string; studentId: string; logTime: string; rank: number | null };

function getRegStudentId(page: PageObjectResponse): string {
  const prop = page.properties[STANDARD_FIELDS.studentId];
  if (!prop) return "";
  if (prop.type === "number") return prop.number !== null ? String(prop.number) : "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  return "";
}

function getRegRank(page: PageObjectResponse): number | null {
  const prop = page.properties[STANDARD_FIELDS.rank];
  return prop?.type === "number" ? prop.number : null;
}

// 이름/학번이 둘 다 빈 페이지는 실제 신청이 아니므로 제외합니다.
export async function getPopupRegistrations(popup: PopupConfig): Promise<PopupRegistration[]> {
  const dataSourceId = await getApplicantDataSourceId(popup);
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const response = await notion.dataSources.query({ data_source_id: dataSourceId, start_cursor: cursor });
    pages.push(...response.results.filter(isFullPage));
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages
    .map((page) => ({
      id: page.id,
      name: getTitleText(page, STANDARD_FIELDS.name),
      studentId: getRegStudentId(page),
      // 페이지 생성 시각(항상 정확)을 순서 기준으로 씁니다. 커스텀 날짜 속성은 절대 쓰지 않습니다.
      logTime: page.created_time,
      rank: getRegRank(page),
    }))
    .filter((r) => r.name.trim() !== "" || r.studentId.trim() !== "");
}

function rankRegistrations(regs: PopupRegistration[]): PopupRegistration[] {
  return [...regs].sort((a, b) => new Date(a.logTime).getTime() - new Date(b.logTime).getTime());
}

export type PopupStats = { confirmedCount: number; waitingCount: number };

export async function getPopupStats(popup: PopupConfig): Promise<PopupStats> {
  const ranked = rankRegistrations(await getPopupRegistrations(popup));
  if (!popup.capacity) return { confirmedCount: ranked.length, waitingCount: 0 };
  return {
    confirmedCount: Math.min(ranked.length, popup.capacity),
    waitingCount: Math.max(0, ranked.length - popup.capacity),
  };
}

export type PopupSubmitResult =
  | { status: "confirmed"; rank: number }
  | { status: "waitlisted"; waitNumber: number }
  | { status: "full" };

function toResult(popup: PopupConfig, rank: number): PopupSubmitResult {
  if (!popup.capacity || rank <= popup.capacity) return { status: "confirmed", rank };
  if (popup.useWaitlist) return { status: "waitlisted", waitNumber: rank - popup.capacity };
  return { status: "full" };
}

function toDisplayRank(popup: PopupConfig, rank: number): number {
  if (!popup.capacity || rank <= popup.capacity) return rank;
  return rank - popup.capacity;
}

// 동시 신청으로 순번이 겹치지 않도록, 매 신청마다 전체 순번을 다시 계산해 저장값과 다른 것만 갱신합니다.
async function resyncRanks(
  popup: PopupConfig,
  regs: PopupRegistration[],
  schema: Record<string, string>
): Promise<PopupRegistration[]> {
  const ranked = rankRegistrations(regs);
  if (schema[STANDARD_FIELDS.rank] !== "number") return ranked;

  await Promise.all(
    ranked.map((r, i) => {
      const displayRank = toDisplayRank(popup, i + 1);
      if (r.rank === displayRank) return Promise.resolve();
      return notion.pages.update({
        page_id: r.id,
        properties: { [STANDARD_FIELDS.rank]: { type: "number", number: displayRank } as PagePropertyValueInput },
      });
    })
  );
  return ranked;
}

// 관리자용: 이미 꼬인 순번을 수동으로 한 번에 재정리합니다.
export async function resyncAllPopupRanks(popup: PopupConfig): Promise<void> {
  const schema = await getApplicantSchema(popup);
  const regs = await getPopupRegistrations(popup);
  await resyncRanks(popup, regs, schema);
}

export type PopupSubmitInput = {
  name: string;
  studentId: string;
  teammateNames?: string[];
  paymentFile?: File;
  extra?: Record<string, string | boolean>;
};

// 이름+학번으로 신청/재신청(수정)합니다. 정원을 넘으면 예비번호(허용 시) 또는 마감 처리됩니다.
export async function submitPopupRegistration(
  popup: PopupConfig,
  input: PopupSubmitInput
): Promise<{ updated: boolean; result: PopupSubmitResult }> {
  const dataSourceId = await getApplicantDataSourceId(popup);
  const schema = await getApplicantSchema(popup);
  const existing = await getPopupRegistrations(popup);
  const match = existing.find((r) => r.studentId === input.studentId.trim());

  const properties: Record<string, PagePropertyValueInput> = {};

  if (popup.teamSlotCount && schema[STANDARD_FIELDS.teammates] === "rich_text") {
    const teammateText = (input.teammateNames ?? []).map((n) => n.trim()).filter(Boolean).join(", ");
    properties[STANDARD_FIELDS.teammates] = {
      type: "rich_text",
      rich_text: teammateText ? [{ type: "text", text: { content: teammateText } }] : [],
    } as PagePropertyValueInput;
  }

  const standardNames: string[] = Object.values(STANDARD_FIELDS);
  for (const field of popup.fields) {
    if (standardNames.includes(field.name) || field.type === "files") continue;
    const value = input.extra?.[field.name];
    if (value === undefined) continue;
    if (field.type === "number" && schema[field.name] === "number") {
      const numeric = Number(value);
      properties[field.name] = {
        type: "number",
        number: Number.isFinite(numeric) ? numeric : null,
      } as PagePropertyValueInput;
    } else if (field.type === "checkbox" && schema[field.name] === "checkbox") {
      properties[field.name] = { type: "checkbox", checkbox: Boolean(value) } as PagePropertyValueInput;
    } else if (field.type === "select" && schema[field.name] === "select") {
      properties[field.name] = {
        type: "select",
        select: value ? { name: String(value) } : null,
      } as PagePropertyValueInput;
    } else if (schema[field.name] === "rich_text") {
      properties[field.name] = {
        type: "rich_text",
        rich_text: value ? [{ type: "text", text: { content: String(value) } }] : [],
      } as PagePropertyValueInput;
    }
  }

  // 학과/학년은 명단에서 확인된 값을 그대로 씁니다 (사용자가 직접 입력하지 않음).
  if (schema[STANDARD_FIELDS.department] === "rich_text" && input.extra?.[STANDARD_FIELDS.department] !== undefined) {
    properties[STANDARD_FIELDS.department] = {
      type: "rich_text",
      rich_text: [{ type: "text", text: { content: String(input.extra[STANDARD_FIELDS.department]) } }],
    } as PagePropertyValueInput;
  }
  if (schema[STANDARD_FIELDS.year] === "rich_text" && input.extra?.[STANDARD_FIELDS.year] !== undefined) {
    properties[STANDARD_FIELDS.year] = {
      type: "rich_text",
      rich_text: [{ type: "text", text: { content: String(input.extra[STANDARD_FIELDS.year]) } }],
    } as PagePropertyValueInput;
  }

  let pageId: string;
  if (match) {
    pageId = match.id;
    if (Object.keys(properties).length > 0) {
      await notion.pages.update({ page_id: pageId, properties });
    }
  } else {
    const nameProp = schema[STANDARD_FIELDS.name] === "title"
      ? STANDARD_FIELDS.name
      : Object.entries(schema).find(([, type]) => type === "title")?.[0] ?? STANDARD_FIELDS.name;
    properties[nameProp] = {
      type: "title",
      title: [{ type: "text", text: { content: input.name.trim() } }],
    } as PagePropertyValueInput;

    if (schema[STANDARD_FIELDS.studentId] === "number") {
      const numeric = Number(input.studentId);
      properties[STANDARD_FIELDS.studentId] = {
        type: "number",
        number: Number.isFinite(numeric) ? numeric : null,
      } as PagePropertyValueInput;
    } else {
      properties[STANDARD_FIELDS.studentId] = {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.studentId.trim() } }],
      } as PagePropertyValueInput;
    }

    const created = await notion.pages.create({
      parent: { data_source_id: dataSourceId, type: "data_source_id" },
      properties,
    });
    pageId = created.id;
  }

  // 정원 초과로 예비번호가 된 신청은 프론트에서 애초에 입금 파일을 받지 않으므로, 여기서는
  // 확정된(또는 정원 없는) 신청에 한해서만 입금 스크린샷을 업로드합니다.
  if (input.paymentFile && schema[STANDARD_FIELDS.payment] === "files") {
    const ext = input.paymentFile.name.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase() || ".jpg";
    const filename = `payment-${Date.now()}${ext}`;
    const fileUpload = await notion.fileUploads.create({
      mode: "single_part",
      filename,
      content_type: input.paymentFile.type || "image/jpeg",
    });
    await notion.fileUploads.send({ file_upload_id: fileUpload.id, file: { filename, data: input.paymentFile } });
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [STANDARD_FIELDS.payment]: {
          type: "files",
          files: [{ type: "file_upload", file_upload: { id: fileUpload.id }, name: filename }],
        } as PagePropertyValueInput,
      },
    });
  }

  const refreshed = await getPopupRegistrations(popup);
  const ranked = await resyncRanks(popup, refreshed, schema);
  const rank = ranked.findIndex((r) => r.id === pageId) + 1;

  return { updated: Boolean(match), result: toResult(popup, rank) };
}

export async function getPopupStatus(
  popup: PopupConfig,
  name: string,
  studentId: string
): Promise<{ found: false } | { found: true; result: PopupSubmitResult }> {
  const registrations = await getPopupRegistrations(popup);
  const match = registrations.find((r) => r.name === name.trim() && r.studentId === studentId.trim());
  if (!match) return { found: false };

  const ranked = rankRegistrations(registrations);
  const rank = ranked.findIndex((r) => r.id === match.id) + 1;
  return { found: true, result: toResult(popup, rank) };
}

// ---- 관리자: 팝업 설정 생성/수정 ----

export type PopupConfigInput = {
  title: string;
  description: string;
  capacity: number | null;
  useWaitlist: boolean;
  deadline: string; // ISO datetime (KST), 예: 2026-09-30T23:59:00+09:00
  depositAmount: number | null;
  applicantDbUrl: string;
  fieldSpec: string;
  rosterUrl?: string;
  teamSlotCount: number | null;
  noticeTitle?: string;
  autoOpenHome: boolean;
  cancelManager?: string;
};

function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "popup"}-${Date.now().toString(36)}`;
}

export function buildPopupProperties(input: PopupConfigInput): Record<string, PagePropertyValueInput> {
  // 이름/학번/학과/학년/입금확인/팀원희망/신청순위는 모든 신청 표에 항상 있는 표준 컬럼이라
  // 여기서 필수로 요구하지 않습니다. fieldSpec은 그 외에 추가로 필요한 필드만 적는 곳입니다.
  parseFieldSpec(input.fieldSpec); // 형식이 잘못되면 여기서 바로 에러를 던집니다.

  const properties: Record<string, PagePropertyValueInput> = {
    ["팝업 제목"]: {
      type: "title",
      title: [{ type: "text", text: { content: input.title.trim() } }],
    } as PagePropertyValueInput,
    ["안내 문구"]: {
      type: "rich_text",
      rich_text: input.description ? [{ type: "text", text: { content: input.description } }] : [],
    } as PagePropertyValueInput,
    ["예비번호 사용"]: { type: "checkbox", checkbox: input.useWaitlist } as PagePropertyValueInput,
    ["마감 일시"]: { type: "date", date: { start: input.deadline } } as PagePropertyValueInput,
    ["연결된 노션 표 링크"]: { type: "url", url: input.applicantDbUrl } as PagePropertyValueInput,
    ["신청 표 필드 구성"]: {
      type: "rich_text",
      rich_text: [{ type: "text", text: { content: input.fieldSpec } }],
    } as PagePropertyValueInput,
    ["명단 DB 링크"]: { type: "url", url: input.rosterUrl || DEFAULT_ROSTER_URL } as PagePropertyValueInput,
    ["취소 담당자"]: {
      type: "rich_text",
      rich_text: input.depositAmount
        ? [{ type: "text", text: { content: (input.cancelManager ?? "").trim() || DEFAULT_CANCEL_MANAGER } }]
        : [],
    } as PagePropertyValueInput,
    ["공지 제목"]: {
      type: "rich_text",
      rich_text: [{ type: "text", text: { content: input.noticeTitle || input.title } }],
    } as PagePropertyValueInput,
    ["홈페이지 자동 팝업"]: { type: "checkbox", checkbox: input.autoOpenHome } as PagePropertyValueInput,
  };

  properties["정원"] = { type: "number", number: input.capacity } as PagePropertyValueInput;
  properties["입금 금액"] = { type: "number", number: input.depositAmount } as PagePropertyValueInput;
  properties["팀원 희망 칸 수"] = { type: "number", number: input.teamSlotCount } as PagePropertyValueInput;

  return properties;
}

export async function createPopupConfig(input: PopupConfigInput): Promise<string> {
  const properties = buildPopupProperties(input);
  properties["상태"] = { type: "select", select: { name: "활성" } } as PagePropertyValueInput;
  properties["slug"] = {
    type: "rich_text",
    rich_text: [{ type: "text", text: { content: slugify(input.title) } }],
  } as PagePropertyValueInput;

  const created = await notion.pages.create({
    parent: { data_source_id: MASTER_DATA_SOURCE_ID, type: "data_source_id" },
    properties,
  });
  return created.id;
}

export async function updatePopupConfig(popupId: string, input: PopupConfigInput): Promise<void> {
  const properties = buildPopupProperties(input);
  await notion.pages.update({ page_id: popupId, properties });
}

export async function setPopupStatus(popupId: string, status: "활성" | "일시중지"): Promise<void> {
  await notion.pages.update({
    page_id: popupId,
    properties: { ["상태"]: { type: "select", select: { name: status } } as PagePropertyValueInput },
  });
}

// "삭제"는 연결된 신청자 명단 표는 그대로 두고, 이 팝업 설정(마스터 DB 항목)만 보관함으로 옮깁니다.
export async function deletePopupConfig(popupId: string): Promise<void> {
  await notion.pages.update({ page_id: popupId, archived: true });
}
