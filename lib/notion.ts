import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_API_KEY });

// MT 신청 관련 데이터베이스(재영님 개인 워크스페이스)는 별도의 Notion 연동 토큰을 씁니다.
// Vercel 환경변수에 NOTION_API_KEY_MT를 추가하면 자동으로 이 클라이언트가 사용됩니다.
const mtNotion = new Client({ auth: process.env.NOTION_API_KEY_MT });

// 새 워크스페이스로 옮긴 콘텐츠(일정/수상/활동/프로젝트/공지사항/운영진소개/동아리소개/졸업생/
// 명단/팝업 관리)는 이 클라이언트로 접근합니다. 나머지 기존 기능(개강총회/교육/튜터링/스터디/
// IRC 신청 표 등)은 계속 기존 NOTION_API_KEY(옛 워크스페이스)를 씁니다.
export const notionNew = new Client({ auth: process.env.NOTION_API_KEY_NEW });

// 새 워크스페이스로 옮긴 5개 데이터베이스 ID (비밀정보 아님, 페이지 URL에서 그대로 가져온 값)
export const DATABASE_IDS = {
  schedule: "96f672e627b1835086f901afd857f97a",
  awards: "f97672e627b1823a8eca01f6d36fdbe2",
  activities: "1a2672e627b1821997f2810809994530",
  projects: "5e4672e627b1822e9bd0019c49d54a44",
  notices: "c19672e627b182e6b38481b6cfc19400",
} as const;

export type DatabaseKey = keyof typeof DATABASE_IDS;

// 데이터베이스 ID -> 데이터소스 ID 캐시 (같은 서버 인스턴스 내에서 반복 조회를 피하기 위함)
const dataSourceIdCache = new Map<string, string>();

export async function getDataSourceId(databaseId: string, client: Client = notion): Promise<string> {
  const cached = dataSourceIdCache.get(databaseId);
  if (cached) return cached;

  const database = await client.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in database) || database.data_sources.length === 0) {
    throw new Error(`데이터베이스(${databaseId})에서 데이터소스를 찾을 수 없습니다.`);
  }

  const dataSourceId = database.data_sources[0].id;
  dataSourceIdCache.set(databaseId, dataSourceId);
  return dataSourceId;
}

export async function getDataSourceIdForKey(key: DatabaseKey): Promise<string> {
  return getDataSourceId(DATABASE_IDS[key], notionNew);
}

export function isFullPage(
  item: { object: string } & Record<string, unknown>
): item is PageObjectResponse {
  return item.object === "page" && "properties" in item && "created_time" in item;
}

// 데이터베이스를 조회하고, 정렬 속성이 없을 경우엔 정렬 없이 재시도합니다.
export async function queryDatabase(
  key: DatabaseKey,
  options?: { sortProperty?: string; direction?: "ascending" | "descending" }
): Promise<PageObjectResponse[]> {
  const dataSourceId = await getDataSourceIdForKey(key);

  const sorts = options?.sortProperty
    ? [{ property: options.sortProperty, direction: options.direction ?? "ascending" }]
    : undefined;

  try {
    const response = await notionNew.dataSources.query({
      data_source_id: dataSourceId,
      sorts,
    });
    return response.results.filter(isFullPage);
  } catch {
    // 정렬 속성이 없는 등의 이유로 실패하면, 정렬 없이 한 번 더 시도합니다.
    const response = await notionNew.dataSources.query({ data_source_id: dataSourceId });
    return response.results.filter(isFullPage);
  }
}

// ---- 속성값 파싱 헬퍼 ----

export function getTitleText(page: PageObjectResponse, propName = "제목"): string {
  const prop = page.properties[propName];
  if (prop?.type === "title") {
    return prop.title.map((t) => t.plain_text).join("");
  }
  return "";
}

export function getRichText(page: PageObjectResponse, propName: string): string {
  const prop = page.properties[propName];
  if (prop?.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

export function getDateStart(page: PageObjectResponse, propName = "날짜"): string | null {
  const prop = page.properties[propName];
  if (prop?.type === "date") {
    return prop.date?.start ?? null;
  }
  return null;
}

export function getFirstFileUrl(page: PageObjectResponse, propName = "사진"): string | null {
  return getFileUrls(page, propName)[0] ?? null;
}

export function getFileUrls(page: PageObjectResponse, propName = "사진"): string[] {
  const prop = page.properties[propName];
  if (prop?.type !== "files") return [];

  return prop.files
    .map((file) => {
      if (file.type === "external") return file.external.url;
      if (file.type === "file") return file.file.url;
      return null;
    })
    .filter((url): url is string => Boolean(url));
}

export function getEmail(page: PageObjectResponse, propName: string): string {
  const prop = page.properties[propName];
  if (prop?.type === "email") return prop.email ?? "";
  return "";
}

export function getCheckbox(page: PageObjectResponse, propName: string): boolean {
  const prop = page.properties[propName];
  if (prop?.type === "checkbox") return prop.checkbox;
  return false;
}

export function getUrl(page: PageObjectResponse, propName: string): string {
  const prop = page.properties[propName];
  if (prop?.type === "url") return prop.url ?? "";
  return "";
}

export function getTagLabel(page: PageObjectResponse, propName = "태그"): string {
  const prop = page.properties[propName];
  if (!prop) return "";
  if (prop.type === "multi_select") return prop.multi_select.map((s) => s.name).join(" · ").trim();
  if (prop.type === "select") return (prop.select?.name ?? "").trim();
  if (prop.type === "status") return (prop.status?.name ?? "").trim();
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  return "";
}

// 날짜 문자열(YYYY-MM-DD 또는 YYYY-MM)을 "3월", "2025" 같은 한국어 표기로 변환
export function formatMonthLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const month = Number(dateStr.split("-")[1]);
  return Number.isFinite(month) ? `${month}월` : "";
}

export function formatYearLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0];
}

export function formatFullDateLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${m}월 ${d}일`;
}

// 연-월만 표시 (예: "2025년 11월")
export function formatYearMonthLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const [y, m] = dateStr.split("-").map(Number);
  if (!y || !m) return dateStr;
  return `${y}년 ${m}월`;
}

// 시작일/종료일을 하나의 표기로 합칩니다.
export function formatDateRangeLabel(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return "";
  if (startDate && !endDate) return `${formatFullDateLabel(startDate)} ~ 진행중`;
  if (!startDate && endDate) return formatFullDateLabel(endDate);
  if (startDate === endDate) return formatFullDateLabel(startDate);
  return `${formatFullDateLabel(startDate)} ~ ${formatFullDateLabel(endDate)}`;
}

// ---- 각 데이터베이스의 실제 속성명 매핑 ----

export const FIELD_CONFIG: Record<
  DatabaseKey,
  {
    title: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    detail?: string;
    tag?: string;
    important?: string;
    url?: string;
    files?: string;
  }
> = {
  schedule: { title: "제목", startDate: "시작일", endDate: "종료일", detail: "상세 내용" },
  activities: { title: "제목", startDate: "시작일", endDate: "종료일", detail: "상세 내용" },
  awards: { title: "제목", date: "날짜", detail: "상세 내용" },
  projects: { title: "제목", startDate: "시작일", endDate: "종료일", tag: "태그", detail: "상세내용" },
  notices: {
    title: "제목",
    date: "날짜",
    detail: "상세내용",
    important: "중요공지",
    url: "URL",
    files: "파일과 미디어",
  },
};

// ---- 통합 아이템 조회 (홈페이지 목록 / 상세 페이지 / 이전-다음 네비게이션 공용) ----

export type NormalizedItem = {
  id: string;
  title: string;
  date: string; // 단일 날짜 DB(수상)용
  dateLabel: string;
  startDate: string; // 시작일/종료일 DB(일정/활동/프로젝트)용
  startDateLabel: string;
  endDate: string;
  endDateLabel: string;
  rangeLabel: string;
  detail: string;
  tag: string;
  important: boolean;
  url: string;
  photoUrl: string | null;
  photoUrls: string[];
};

function normalizeItem(key: DatabaseKey, page: PageObjectResponse): NormalizedItem {
  const config = FIELD_CONFIG[key];
  const rawDate = config.date ? getDateStart(page, config.date) : null;
  const rawStart = config.startDate ? getDateStart(page, config.startDate) : null;
  const rawEnd = config.endDate ? getDateStart(page, config.endDate) : null;

  const startDate = (rawStart ?? "").slice(0, 10);
  const endDate = (rawEnd ?? "").slice(0, 10);
  const photoUrls = getFileUrls(page, config.files ?? "사진");

  return {
    id: page.id,
    title: getTitleText(page, config.title),
    date: (rawDate ?? "").slice(0, 10),
    dateLabel: config.date ? formatFullDateLabel(rawDate) : formatDateRangeLabel(startDate, endDate),
    startDate,
    startDateLabel: formatFullDateLabel(rawStart),
    endDate,
    endDateLabel: formatFullDateLabel(rawEnd),
    rangeLabel: formatDateRangeLabel(startDate, endDate),
    detail: config.detail ? getRichText(page, config.detail) : "",
    tag: config.tag ? getTagLabel(page, config.tag) : "",
    important: config.important ? getCheckbox(page, config.important) : false,
    url: config.url ? getUrl(page, config.url) : "",
    photoUrl: photoUrls[0] ?? null,
    photoUrls,
  };
}

// 데이터베이스의 모든 항목을 가져옵니다 (정렬/필터는 호출부에서 처리).
export async function getAllItems(key: DatabaseKey): Promise<NormalizedItem[]> {
  const pages = await queryDatabase(key);
  return pages.map((page) => normalizeItem(key, page));
}

// 기준 날짜(시작일/종료일/단일날짜)로 정렬합니다. 날짜가 없는 항목은 맨 뒤로 보냅니다.
export function sortByDate(
  items: NormalizedItem[],
  which: "start" | "end" | "date",
  direction: "ascending" | "descending" = "descending"
): NormalizedItem[] {
  const getValue = (item: NormalizedItem): string => {
    if (which === "start") return item.startDate || item.date;
    if (which === "end") return item.endDate || item.startDate || item.date;
    return item.date || item.startDate;
  };

  return [...items].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return direction === "ascending" ? av.localeCompare(bv) : bv.localeCompare(av);
  });
}

// 오늘(KST) 이후에 끝나거나 아직 끝나지 않은(진행중) 항목만 남깁니다.
export function filterNotPast(items: NormalizedItem[], todayStr: string): NormalizedItem[] {
  return items.filter((item) => {
    const reference = item.endDate || item.startDate || item.date;
    if (!reference) return true;
    return reference >= todayStr;
  });
}

// 오늘(KST) 기준으로 이미 끝난(종료일이 지난) 항목만 남깁니다.
export function filterPast(items: NormalizedItem[], todayStr: string): NormalizedItem[] {
  return items.filter((item) => {
    const reference = item.endDate || item.startDate || item.date;
    if (!reference) return false;
    return reference < todayStr;
  });
}

export async function getItemById(key: DatabaseKey, id: string): Promise<NormalizedItem | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (!isFullPage(page as { object: string } & Record<string, unknown>)) return null;
    return normalizeItem(key, page as PageObjectResponse);
  } catch {
    return null;
  }
}

// ---- 항목 생성/수정 (관리자 모드) ----

export type ItemFormFields = {
  title: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  detail?: string;
  tag?: string;
  important?: boolean;
  url?: string;
};

type PagePropertiesInput = NonNullable<
  Parameters<typeof notion.pages.update>[0]["properties"]
>;
type PagePropertyValueInput = PagePropertiesInput[string];

const schemaCache = new Map<DatabaseKey, Record<string, string>>();

async function getPropertySchema(key: DatabaseKey): Promise<Record<string, string>> {
  const cached = schemaCache.get(key);
  if (cached) return cached;

  const dataSourceId = await getDataSourceIdForKey(key);
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });

  const schema: Record<string, string> = {};
  if ("properties" in dataSource) {
    for (const [name, config] of Object.entries(dataSource.properties)) {
      schema[name] = config.type;
    }
  }
  schemaCache.set(key, schema);
  return schema;
}

function buildPropertyPayload(
  type: string,
  value: string | number | boolean | null
): PagePropertyValueInput | null {
  switch (type) {
    case "title":
      return {
        type: "title",
        title: value ? [{ type: "text", text: { content: String(value) } }] : [],
      } as PagePropertyValueInput;
    case "rich_text":
      return {
        type: "rich_text",
        rich_text: value ? [{ type: "text", text: { content: String(value) } }] : [],
      } as PagePropertyValueInput;
    case "date":
      return { type: "date", date: value ? { start: String(value) } : null } as PagePropertyValueInput;
    case "number":
      return {
        type: "number",
        number: value === null || value === "" ? null : Number(value),
      } as PagePropertyValueInput;
    case "select":
      return { type: "select", select: value ? { name: String(value) } : null } as PagePropertyValueInput;
    case "multi_select":
      return {
        type: "multi_select",
        multi_select: String(value ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      } as PagePropertyValueInput;
    case "checkbox":
      return { type: "checkbox", checkbox: Boolean(value) } as PagePropertyValueInput;
    case "url":
      return { type: "url", url: value ? String(value) : null } as PagePropertyValueInput;
    default:
      return null;
  }
}

async function buildPropertiesFromFields(
  key: DatabaseKey,
  fields: Partial<ItemFormFields>
): Promise<Record<string, PagePropertyValueInput>> {
  const config = FIELD_CONFIG[key];
  const schema = await getPropertySchema(key);
  const properties: Record<string, PagePropertyValueInput> = {};

  // 실제로 해당 데이터베이스에 존재하는 속성일 때만 값을 채워 넣습니다.
  // (없는 속성 이름으로 보내면 Notion API가 오류를 반환합니다.)
  function setIfExists(propName: string | undefined, value: string | boolean | null) {
    if (!propName) return;
    const type = schema[propName];
    if (!type) return; // 데이터베이스에 이 속성이 없으면 조용히 건너뜁니다.
    const payload = buildPropertyPayload(type, value);
    if (payload) properties[propName] = payload;
  }

  if (fields.title !== undefined) {
    const titleType = schema[config.title] ?? "title";
    const payload = buildPropertyPayload(titleType, fields.title);
    if (payload) properties[config.title] = payload;
  }

  if (fields.date !== undefined) setIfExists(config.date, fields.date || null);
  if (fields.startDate !== undefined) setIfExists(config.startDate, fields.startDate || null);
  if (fields.endDate !== undefined) setIfExists(config.endDate, fields.endDate || null);
  if (fields.detail !== undefined) setIfExists(config.detail, fields.detail);
  if (fields.tag !== undefined) setIfExists(config.tag, fields.tag);
  if (fields.important !== undefined) setIfExists(config.important, fields.important);
  if (fields.url !== undefined) setIfExists(config.url, fields.url || null);

  return properties;
}

export async function createNotionItem(
  key: DatabaseKey,
  fields: ItemFormFields
): Promise<string> {
  const dataSourceId = await getDataSourceIdForKey(key);
  const properties = await buildPropertiesFromFields(key, fields);

  const page = await notion.pages.create({
    parent: { data_source_id: dataSourceId, type: "data_source_id" },
    properties,
  });

  return page.id;
}

export async function updateNotionItem(
  key: DatabaseKey,
  pageId: string,
  fields: Partial<ItemFormFields>
): Promise<void> {
  const properties = await buildPropertiesFromFields(key, fields);
  if (Object.keys(properties).length === 0) return;

  await notion.pages.update({ page_id: pageId, properties });
}

// Notion API는 완전 삭제 대신 "보관(휴지통으로 이동)"을 지원합니다.
// Notion에서 사용자가 직접 삭제하는 것과 동일하게 동작하며, 필요하면 Notion 휴지통에서 복구할 수 있습니다.
export async function deleteNotionItem(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true });
}

// ---- 운영진 소개 (별도 데이터베이스, 나머지 4개와 구조가 달라 독립적으로 처리) ----

const OFFICERS_DATABASE_ID = "4d2672e627b182bca32381c53baf2258";
let officersDataSourceIdCache: string | null = null;

async function getOfficersDataSourceId(): Promise<string> {
  if (officersDataSourceIdCache) return officersDataSourceIdCache;
  officersDataSourceIdCache = await getDataSourceId(OFFICERS_DATABASE_ID, notionNew);
  return officersDataSourceIdCache;
}

export type Officer = {
  id: string;
  name: string;
  department: string;
  position: string;
  contact: string;
  github: string;
  major: string;
  photoUrl: string | null;
};

export async function getOfficers(): Promise<Officer[]> {
  const dataSourceId = await getOfficersDataSourceId();
  const response = await notionNew.dataSources.query({ data_source_id: dataSourceId });
  const pages = response.results.filter((item): item is PageObjectResponse =>
    isFullPage(item as { object: string } & Record<string, unknown>)
  );

  return pages.map((page) => ({
    id: page.id,
    name: getTitleText(page, "이름"),
    department: getTagLabel(page, "부서"),
    position: getTagLabel(page, "직책"),
    contact: getEmail(page, "연락처"),
    github: getUrl(page, "깃허브"),
    major: getRichText(page, "학과"),
    photoUrl: getFirstFileUrl(page),
  }));
}

export type OfficerSection = { label: string; members: Officer[] };

// 회장 -> 부회장 -> 부서(가나다순) 순으로 묶고, 부서 내에서는 부장이 맨 위,
// 나머지는 이름 가나다순으로 정렬합니다.
export function groupOfficers(officers: Officer[]): OfficerSection[] {
  const byName = (a: Officer, b: Officer) => a.name.localeCompare(b.name, "ko");

  const president = officers.filter((o) => o.position === "회장").sort(byName);
  const vicePresident = officers.filter((o) => o.position === "부회장").sort(byName);
  const rest = officers.filter((o) => o.position !== "회장" && o.position !== "부회장");

  const deptMap = new Map<string, Officer[]>();
  for (const officer of rest) {
    const dept = officer.department || "기타";
    const list = deptMap.get(dept) ?? [];
    list.push(officer);
    deptMap.set(dept, list);
  }

  const deptNames = [...deptMap.keys()].sort((a, b) => a.localeCompare(b, "ko"));

  const sections: OfficerSection[] = [];
  if (president.length) sections.push({ label: "회장", members: president });
  if (vicePresident.length) sections.push({ label: "부회장", members: vicePresident });

  for (const dept of deptNames) {
    const members = deptMap.get(dept) ?? [];
    members.sort((a, b) => {
      const aHead = a.position === "부장" ? 0 : 1;
      const bHead = b.position === "부장" ? 0 : 1;
      if (aHead !== bHead) return aHead - bHead;
      return a.name.localeCompare(b.name, "ko");
    });
    sections.push({ label: dept, members });
  }

  return sections;
}

// ---- 동아리 소개 (별도 데이터베이스: 이름 + 내용) ----

const CLUB_INTRO_DATABASE_ID = "922672e627b1823e86818104c49d51c5";
let clubIntroDataSourceIdCache: string | null = null;

async function getClubIntroDataSourceId(): Promise<string> {
  if (clubIntroDataSourceIdCache) return clubIntroDataSourceIdCache;
  clubIntroDataSourceIdCache = await getDataSourceId(CLUB_INTRO_DATABASE_ID, notionNew);
  return clubIntroDataSourceIdCache;
}

export type ClubIntroSection = {
  id: string;
  name: string;
  content: string;
};

export async function getClubIntroSections(): Promise<ClubIntroSection[]> {
  const dataSourceId = await getClubIntroDataSourceId();
  const response = await notionNew.dataSources.query({ data_source_id: dataSourceId });
  const pages = response.results.filter((item): item is PageObjectResponse =>
    isFullPage(item as { object: string } & Record<string, unknown>)
  );

  return pages
    .map((page) => ({
      id: page.id,
      name: getTitleText(page, "이름"),
      content: getRichText(page, "내용"),
    }))
    .reverse();
}

// ---- 졸업생 (별도 데이터베이스: 이름/학과/현재/졸업연도/이메일/URL) ----

const ALUMNI_DATABASE_ID = "6f2672e627b18242b4f1018ed0c79b8e";
let alumniDataSourceIdCache: string | null = null;

async function getAlumniDataSourceId(): Promise<string> {
  if (alumniDataSourceIdCache) return alumniDataSourceIdCache;
  alumniDataSourceIdCache = await getDataSourceId(ALUMNI_DATABASE_ID, notionNew);
  return alumniDataSourceIdCache;
}

export type Alumnus = {
  id: string;
  name: string;
  major: string;
  current: string;
  graduationYear: number | null;
  email: string;
  url: string;
};

export async function getAlumni(): Promise<Alumnus[]> {
  const dataSourceId = await getAlumniDataSourceId();
  const response = await notionNew.dataSources.query({ data_source_id: dataSourceId });
  const pages = response.results.filter((item): item is PageObjectResponse =>
    isFullPage(item as { object: string } & Record<string, unknown>)
  );

  const alumni = pages.map((page) => ({
    id: page.id,
    name: getTitleText(page, "이름"),
    major: getRichText(page, "학과"),
    current: getRichText(page, "현재"),
    graduationYear: (() => {
      const prop = page.properties["졸업연도"];
      return prop?.type === "number" ? prop.number : null;
    })(),
    email: getEmail(page, "이메일"),
    url: getUrl(page, "URL"),
  }));

  // 졸업연도가 최신인 순으로 정렬 (연도 없는 사람은 맨 뒤)
  return alumni.sort((a, b) => {
    if (a.graduationYear === null && b.graduationYear === null) return 0;
    if (a.graduationYear === null) return 1;
    if (b.graduationYear === null) return -1;
    return b.graduationYear - a.graduationYear;
  });
}

// ---- 동아리원 명단 (신규등록+재등록을 합친 통합 명단, 새 워크스페이스) ----
// 개강총회 신청 시 "동아리 사람인지" 판단하는 기준으로 사용합니다 (이름+학번이 둘 다 일치해야 함).
// 예전엔 신규등록/재등록 응답 시트 2개를 따로 합쳤지만, 지금은 통합된 표 1개입니다.

const MEMBER_ROSTER_DATABASE_ID = "b60672e627b183ed9631813fab299f28";

type RosterEntry = { name: string; studentId: string };

const rosterCache = new Map<string, { entries: RosterEntry[]; fetchedAt: number }>();
const ROSTER_CACHE_TTL_MS = 60 * 1000; // 1분마다 새로고침

async function fetchRosterFromDatabase(databaseId: string): Promise<RosterEntry[]> {
  const cached = rosterCache.get(databaseId);
  if (cached && Date.now() - cached.fetchedAt < ROSTER_CACHE_TTL_MS) {
    return cached.entries;
  }

  const dataSourceId = await getDataSourceId(databaseId, notionNew);
  const entries: RosterEntry[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionNew.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    const pages = response.results.filter((item): item is PageObjectResponse =>
      isFullPage(item as { object: string } & Record<string, unknown>)
    );

    for (const page of pages) {
      // 통합 명단은 "이름"이 타이틀 속성입니다 (예전 구글폼 응답 시트의 "성명"과 다름).
      const name = getTitleText(page, "이름").trim();
      let studentId = "";
      for (const [key, prop] of Object.entries(page.properties)) {
        // "학번" 또는 "학번 (예: 20261234)"처럼 예시가 붙어있을 수 있고, 새 워크스페이스로
        // 옮겨진 통합 명단 표는 컬럼 이름이 자동 생성된 "Column 5"(학번)입니다.
        if (!key.startsWith("학번") && key !== "Column 5") continue;
        if (prop.type === "number" && prop.number !== null) {
          studentId = String(prop.number);
        } else if (prop.type === "rich_text") {
          studentId = prop.rich_text.map((t) => t.plain_text).join("").trim();
        }
        break;
      }
      if (name || studentId) entries.push({ name, studentId });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  rosterCache.set(databaseId, { entries, fetchedAt: Date.now() });
  return entries;
}

// 통합 명단에서 이름과 학번이 정확히 일치하는 동아리원인지 확인합니다.
export async function isClubMember(name: string, studentId: string): Promise<boolean> {
  const entries = await fetchRosterFromDatabase(MEMBER_ROSTER_DATABASE_ID);
  return entries.some((r) => r.name === name && r.studentId === studentId);
}

// 개강총회 신청 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_OPENING_MODAL = true;

// 프린터기·인두기 교육 신청 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_TRAINING_MODAL = true;

// 교육 신청 팝업 자동 마감 시각 (한국 시간). 이 시각이 지나면 SHOW_TRAINING_MODAL이 true여도 자동으로 숨겨집니다.
export const TRAINING_DEADLINE = "2026-09-08T00:00:00+09:00";
export function isTrainingPeriodOver(): boolean {
  return Date.now() >= new Date(TRAINING_DEADLINE).getTime();
}

// 공지사항 중, 제목이 이 값과 정확히 일치하는 항목은 클릭 시 (다른 페이지로 이동하는 대신)
// 개강총회 신청 팝업을 엽니다. 노션에서 이 제목 그대로 공지를 만들어 두면 자동으로 연결됩니다.
export const OPENING_NOTICE_TITLE = "개강총회 신청";

// ---- 개강총회 신청 (별도 데이터베이스: 이름 + 학번 + 참석 항목 체크 + 로그 + 입금확인) ----

const OPENING_DATABASE_ID = "3b3474b8fa7e800bbabdf4f789e1ff1d";
const OPENING_STUDENT_ID_PROP = "학번";
const OPENING_LOG_PROP = "로그";
const OPENING_PAYMENT_PROP = "입금확인";
const OPENING_EVENT_PROPS = {
  opening: "개강총회",
  afterParty1: "뒷풀이1차",
  afterParty2: "뒷풀이2차",
} as const;
const OPENING_WAITLIST_EMAIL_PROP = "대기 이메일";
const OPENING_WAITLIST_NOTIFIED_PROP = "대기 알림 발송";

// 뒷풀이 1차는 좌석 제한이 있어 정원을 보여줍니다.
export const AFTER_PARTY1_CAPACITY = 73;

// 접수 시작 시각 (한국 시간 기준). 이 시각 이전에는 신청을 받지 않습니다.
export const OPENING_START_TIME = "2026-08-24T09:25:00+09:00";

// 접수 마감 시각 (한국 시간 기준, 9/2 밤 12시 = 9/3 00:00). 이 시각 이후에는
// 팝업 자체와 공지사항 항목을 화면에서 아예 숨깁니다.
export const OPENING_DEADLINE = "2026-09-03T00:00:00+09:00";

export function isOpeningPeriodOver(): boolean {
  return Date.now() >= new Date(OPENING_DEADLINE).getTime();
}

let openingDataSourceIdCache: string | null = null;
let openingSchemaCache: Record<string, string> | null = null;

async function getOpeningDataSourceId(): Promise<string> {
  if (openingDataSourceIdCache) return openingDataSourceIdCache;
  openingDataSourceIdCache = await getDataSourceId(OPENING_DATABASE_ID);
  return openingDataSourceIdCache;
}

async function getOpeningSchema(): Promise<Record<string, string>> {
  if (openingSchemaCache) return openingSchemaCache;
  const dataSourceId = await getOpeningDataSourceId();
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });

  const schema: Record<string, string> = {};
  if ("properties" in dataSource) {
    for (const [name, config] of Object.entries(dataSource.properties)) {
      schema[name] = config.type;
    }
  }
  openingSchemaCache = schema;
  return schema;
}

function getOpeningStudentId(page: PageObjectResponse): string {
  const prop = page.properties[OPENING_STUDENT_ID_PROP];
  if (!prop) return "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  if (prop.type === "number") return prop.number !== null ? String(prop.number) : "";
  if (prop.type === "title") return prop.title.map((t) => t.plain_text).join("").trim();
  return "";
}

export type OpeningEvents = {
  opening: boolean;
  afterParty1: boolean;
  afterParty2: boolean;
};

export type OpeningRegistration = {
  id: string;
  name: string;
  studentId: string;
  events: OpeningEvents;
  logTime: string; // 항상 노션 페이지의 실제 생성 시각(created_time)을 사용 (커스텀 속성에 의존하지 않음)
  waitlistEmail: string;
  waitlistNotified: boolean;
};

// 이름/학번이 둘 다 비어있는 빈 페이지(노션에서 실수로 만들어진 빈 행 등)는 실제 신청이 아니므로 제외합니다.
export async function getOpeningRegistrations(): Promise<OpeningRegistration[]> {
  const dataSourceId = await getOpeningDataSourceId();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    pages.push(
      ...response.results.filter((item): item is PageObjectResponse =>
        isFullPage(item as { object: string } & Record<string, unknown>)
      )
    );
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages
    .map((page) => {
      // "로그"라는 커스텀 속성 이름/타입에 의존하면 설정이 조금만 달라도 항상 null이 되는 문제가 있어서,
      // 노션 페이지 자체의 생성 시각(모든 페이지에 항상 존재, 절대 null이 아님)을 순서 기준으로 씁니다.
      const logTime = page.created_time;
      return {
        id: page.id,
        name: getTitleText(page, "이름"),
        studentId: getOpeningStudentId(page),
        events: {
          opening: getCheckbox(page, OPENING_EVENT_PROPS.opening),
          afterParty1: getCheckbox(page, OPENING_EVENT_PROPS.afterParty1),
          afterParty2: getCheckbox(page, OPENING_EVENT_PROPS.afterParty2),
        },
        logTime,
        waitlistEmail: getEmail(page, OPENING_WAITLIST_EMAIL_PROP),
        waitlistNotified: getCheckbox(page, OPENING_WAITLIST_NOTIFIED_PROP),
      };
    })
    .filter((r) => r.name.trim() !== "" || r.studentId.trim() !== "");
}

// 뒷풀이 1차 체크한 사람들을 신청 시각(로그) 오름차순으로 정렬합니다. 앞쪽 정원(capacity)명이 확정, 나머지는 대기입니다.
function rankAfterParty1(registrations: OpeningRegistration[]): OpeningRegistration[] {
  return registrations
    .filter((r) => r.events.afterParty1)
    .sort((a, b) => new Date(a.logTime).getTime() - new Date(b.logTime).getTime());
}

export type AfterParty1Stats = {
  capacity: number;
  confirmedCount: number;
  waitingCount: number;
};

export async function getAfterParty1Stats(): Promise<AfterParty1Stats> {
  const ranked = rankAfterParty1(await getOpeningRegistrations());
  return {
    capacity: AFTER_PARTY1_CAPACITY,
    confirmedCount: Math.min(ranked.length, AFTER_PARTY1_CAPACITY),
    waitingCount: Math.max(0, ranked.length - AFTER_PARTY1_CAPACITY),
  };
}

// 정원이 차서 대기 명단이었던 사람 중, 앞사람이 빠져서(관리자가 노션에서 취소 처리 등) 확정으로
// 올라온 사람에게 이메일을 보내고, 다시 보내지 않도록 "대기 알림 발송"을 체크합니다.
// 대기 이메일/알림 발송 속성이 아직 노션에 없으면 조용히 건너뜁니다.
export async function promoteAfterParty1Waitlist(): Promise<void> {
  const schema = await getOpeningSchema();
  if (
    schema[OPENING_WAITLIST_EMAIL_PROP] !== "email" ||
    schema[OPENING_WAITLIST_NOTIFIED_PROP] !== "checkbox"
  ) {
    return;
  }

  const ranked = rankAfterParty1(await getOpeningRegistrations());
  const confirmed = ranked.slice(0, AFTER_PARTY1_CAPACITY);
  const toNotify = confirmed.filter((r) => r.waitlistEmail && !r.waitlistNotified);
  if (toNotify.length === 0) return;

  const { sendMail } = await import("./mailer");

  for (const r of toNotify) {
    // 반복 발송을 막기 위해, 메일을 보내기 "전에" 먼저 발송 체크를 남깁니다.
    // (체크 저장에 실패하면 안전하게 이번엔 건너뛰고, 다음 기회에 다시 시도합니다.)
    try {
      await notion.pages.update({
        page_id: r.id,
        properties: {
          [OPENING_WAITLIST_NOTIFIED_PROP]: { type: "checkbox", checkbox: true } as PagePropertyValueInput,
        },
      });
    } catch (error) {
      console.error("대기 알림 발송 체크 저장 실패, 이번엔 메일을 보내지 않습니다:", r.id, error);
      continue;
    }

    try {
      await sendMail({
        to: r.waitlistEmail,
        bcc: "brightyes7@cau.ac.kr",
        subject: "[CHIRO] 뒷풀이 1차 대기가 풀렸습니다",
        html: `
          <div style="font-family: sans-serif; line-height: 1.6;">
            <p>${r.name}님, 대기 중이던 뒷풀이 1차 자리가 나서 참석이 확정되었습니다.</p>
            <p>아래 계좌로 회비 입금 후, 입금 확인 스크린샷을 <strong>운영진 권정예</strong>에게 보내주세요.</p>
            <p style="font-size: 15px;">
              토스뱅크 1002-4084-6167 (예금주: 옥소이)<br />
              입금 금액: 15,000원
            </p>
            <p style="color: #64748b; font-size: 13px;">개강총회 뒷풀이 1차에 참석이 어려우시다면 운영진에게 연락 부탁드립니다.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("대기자 알림 메일 발송 실패 (체크는 이미 저장됨):", r.id, error);
    }
  }
}

// 이름+학번으로 신청/참석여부를 등록하거나(기존 신청이 있으면) 갱신합니다.
// 신청 시각은 "로그" 속성(date)에 남기고, 입금 확인 스크린샷이 있으면 "입금확인" 속성에 첨부합니다.
// 뒷풀이 1차가 정원을 넘으면 대기로 처리하고, 대기 이메일이 있으면 저장해 둡니다.
export type AfterParty1Result =
  | { status: "not-applicable" }
  | { status: "confirmed"; rank: number }
  | { status: "waitlisted"; waitNumber: number };

export async function submitOpeningRegistration(
  name: string,
  studentId: string,
  events: OpeningEvents,
  paymentFile?: File,
  waitlistEmail?: string
): Promise<{ id: string; updated: boolean; logTime: string; afterParty1: AfterParty1Result }> {
  const dataSourceId = await getOpeningDataSourceId();
  const schema = await getOpeningSchema();

  const existing = await getOpeningRegistrations();
  const match = existing.find((r) => r.studentId === studentId);

  const logTime = new Date().toISOString();

  const properties: Record<string, PagePropertyValueInput> = {
    [OPENING_EVENT_PROPS.opening]: { type: "checkbox", checkbox: events.opening } as PagePropertyValueInput,
    [OPENING_EVENT_PROPS.afterParty1]: {
      type: "checkbox",
      checkbox: events.afterParty1,
    } as PagePropertyValueInput,
    [OPENING_EVENT_PROPS.afterParty2]: {
      type: "checkbox",
      checkbox: events.afterParty2,
    } as PagePropertyValueInput,
  };

  if (!match) {
    const nameProp = Object.entries(schema).find(([, type]) => type === "title")?.[0] ?? "이름";
    properties[nameProp] = {
      type: "title",
      title: [{ type: "text", text: { content: name } }],
    } as PagePropertyValueInput;

    const studentIdType = schema[OPENING_STUDENT_ID_PROP];
    if (studentIdType === "number") {
      const numeric = Number(studentId);
      properties[OPENING_STUDENT_ID_PROP] = {
        type: "number",
        number: Number.isFinite(numeric) ? numeric : null,
      } as PagePropertyValueInput;
    } else {
      properties[OPENING_STUDENT_ID_PROP] = {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: studentId } }],
      } as PagePropertyValueInput;
    }
  }

  // 순번(대기/확정) 계산 기준이 흔들리지 않도록, "로그"는 처음 신청할 때만 기록하고
  // 이후 내용을 수정(재제출)해도 순서를 그대로 유지합니다.
  if (!match && schema[OPENING_LOG_PROP] === "date") {
    properties[OPENING_LOG_PROP] = {
      type: "date",
      date: { start: logTime },
    } as PagePropertyValueInput;
  }

  if (
    events.afterParty1 &&
    waitlistEmail &&
    schema[OPENING_WAITLIST_EMAIL_PROP] === "email"
  ) {
    properties[OPENING_WAITLIST_EMAIL_PROP] = {
      type: "email",
      email: waitlistEmail,
    } as PagePropertyValueInput;
  }

  let pageId: string;
  if (match) {
    pageId = match.id;
    await notion.pages.update({ page_id: pageId, properties });
  } else {
    const created = await notion.pages.create({
      parent: { data_source_id: dataSourceId, type: "data_source_id" },
      properties,
    });
    pageId = created.id;
  }

  if (paymentFile && schema[OPENING_PAYMENT_PROP] === "files") {
    const ext = paymentFile.name.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase() || ".jpg";
    const filename = `payment-${Date.now()}${ext}`;
    const fileUpload = await notion.fileUploads.create({
      mode: "single_part",
      filename,
      content_type: paymentFile.type || "image/jpeg",
    });
    await notion.fileUploads.send({ file_upload_id: fileUpload.id, file: { filename, data: paymentFile } });
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [OPENING_PAYMENT_PROP]: {
          type: "files",
          files: [{ type: "file_upload", file_upload: { id: fileUpload.id }, name: filename }],
        } as PagePropertyValueInput,
      },
    });
  }

  let afterParty1: AfterParty1Result = { status: "not-applicable" };
  if (events.afterParty1) {
    const ranked = rankAfterParty1(await getOpeningRegistrations());
    const rank = ranked.findIndex((r) => r.id === pageId) + 1;
    afterParty1 =
      rank > 0 && rank <= AFTER_PARTY1_CAPACITY
        ? { status: "confirmed", rank }
        : { status: "waitlisted", waitNumber: Math.max(1, rank - AFTER_PARTY1_CAPACITY) };
  }

  return { id: pageId, updated: Boolean(match), logTime, afterParty1 };
}

// ---- 프린터기·인두기 교육 신청 (다음주 화/수/목, 타임당 15명) ----

const TRAINING_DATABASE_ID = "3d0474b8fa7e80228f0dc2dfb0bd0e84";
const TRAINING_STUDENT_ID_PROP = "학번";
const TRAINING_DATE_PROP = "날짜";
const TRAINING_TIME_PROP = "시간대";
const TRAINING_TYPE_PROP = "교육종류";
const TRAINING_CANCELLED_PROP = "취소여부";

export const TRAINING_CAPACITY_PER_SLOT = 15;

export type TrainingType = "printer" | "solder";

export const TRAINING_TYPE_LABEL: Record<TrainingType, string> = {
  printer: "프린터기",
  solder: "인두기",
};

export type TrainingSlotOption = { date: string; dateLabel: string; time: string };

// 다음주 화(9/8)·수(9/9)·목(9/10) 고정 일정
export const TRAINING_SLOTS: Record<TrainingType, TrainingSlotOption[]> = {
  printer: [
    { date: "2026-09-08", dateLabel: "9/8(화)", time: "11:00-12:00" },
    { date: "2026-09-08", dateLabel: "9/8(화)", time: "17:00-18:00" },
    { date: "2026-09-09", dateLabel: "9/9(수)", time: "11:00-12:00" },
    { date: "2026-09-09", dateLabel: "9/9(수)", time: "17:00-18:00" },
    { date: "2026-09-10", dateLabel: "9/10(목)", time: "11:00-12:00" },
    { date: "2026-09-10", dateLabel: "9/10(목)", time: "17:00-18:00" },
  ],
  solder: [
    { date: "2026-09-08", dateLabel: "9/8(화)", time: "12:00-13:00" },
    { date: "2026-09-08", dateLabel: "9/8(화)", time: "18:00-19:00" },
    { date: "2026-09-09", dateLabel: "9/9(수)", time: "12:00-13:00" },
    { date: "2026-09-09", dateLabel: "9/9(수)", time: "18:00-19:00" },
    { date: "2026-09-10", dateLabel: "9/10(목)", time: "12:00-13:00" },
    { date: "2026-09-10", dateLabel: "9/10(목)", time: "18:00-19:00" },
  ],
};

// 공지사항에서 이 제목과 정확히 일치하는 공지를 클릭하면 교육 신청 팝업을 엽니다.
export const TRAINING_NOTICE_TITLE = "프린터기·인두기 교육 신청";

let trainingDataSourceIdCache: string | null = null;
let trainingSchemaCache: Record<string, string> | null = null;

async function getTrainingDataSourceId(): Promise<string> {
  if (trainingDataSourceIdCache) return trainingDataSourceIdCache;
  trainingDataSourceIdCache = await getDataSourceId(TRAINING_DATABASE_ID);
  return trainingDataSourceIdCache;
}

async function getTrainingSchema(): Promise<Record<string, string>> {
  if (trainingSchemaCache) return trainingSchemaCache;
  const dataSourceId = await getTrainingDataSourceId();
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const schema: Record<string, string> = {};
  if ("properties" in dataSource) {
    for (const [name, config] of Object.entries(dataSource.properties)) {
      schema[name] = config.type;
    }
  }
  trainingSchemaCache = schema;
  return schema;
}

function getTrainingStudentId(page: PageObjectResponse): string {
  const prop = page.properties[TRAINING_STUDENT_ID_PROP];
  if (!prop) return "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  if (prop.type === "number") return prop.number !== null ? String(prop.number) : "";
  return "";
}

function getTrainingSelect(page: PageObjectResponse, propName: string): string {
  const prop = page.properties[propName];
  if (prop?.type === "select") return prop.select?.name ?? "";
  return "";
}

function getTrainingDate(page: PageObjectResponse): string {
  const prop = page.properties[TRAINING_DATE_PROP];
  if (prop?.type === "date") return prop.date?.start?.slice(0, 10) ?? "";
  return "";
}

function parseTrainingType(label: string): TrainingType | null {
  if (label === "프린터기") return "printer";
  if (label === "인두기") return "solder";
  return null;
}

export type TrainingRegistration = {
  id: string;
  name: string;
  studentId: string;
  type: TrainingType | null;
  date: string;
  time: string;
  cancelled: boolean;
};

export async function getTrainingRegistrations(): Promise<TrainingRegistration[]> {
  const dataSourceId = await getTrainingDataSourceId();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    pages.push(
      ...response.results.filter((item): item is PageObjectResponse =>
        isFullPage(item as { object: string } & Record<string, unknown>)
      )
    );
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages
    .map((page) => ({
      id: page.id,
      name: getTitleText(page, "이름"),
      studentId: getTrainingStudentId(page),
      type: parseTrainingType(getTrainingSelect(page, TRAINING_TYPE_PROP)),
      date: getTrainingDate(page),
      time: getTrainingSelect(page, TRAINING_TIME_PROP),
      cancelled: getCheckbox(page, TRAINING_CANCELLED_PROP),
    }))
    .filter((r) => r.name.trim() !== "" || r.studentId.trim() !== "");
}

// 각 (날짜+시간대) 슬롯마다 취소되지 않은 신청 인원 수
export async function getTrainingSlotCounts(): Promise<Record<string, number>> {
  const registrations = await getTrainingRegistrations();
  const counts: Record<string, number> = {};
  for (const r of registrations) {
    if (r.cancelled || !r.date || !r.time) continue;
    const key = `${r.date}_${r.time}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export type TrainingSlotSelection = { date: string; time: string } | null;

export type TrainingSubmitResult = {
  printer: "registered" | "cancelled" | "unchanged" | "not-selected";
  solder: "registered" | "cancelled" | "unchanged" | "not-selected";
};

// 이름+학번으로 프린터기/인두기 교육 신청을 등록·변경·취소합니다.
// printerSlot/solderSlot이 null이면 그 종류는 신청 안 함(기존에 있었다면 취소 처리).
export async function submitTrainingSelection(
  name: string,
  studentId: string,
  printerSlot: TrainingSlotSelection,
  solderSlot: TrainingSlotSelection
): Promise<TrainingSubmitResult> {
  const dataSourceId = await getTrainingDataSourceId();
  const schema = await getTrainingSchema();
  const existing = await getTrainingRegistrations();

  const result: TrainingSubmitResult = { printer: "not-selected", solder: "not-selected" };

  const tasks: { type: TrainingType; slot: TrainingSlotSelection }[] = [
    { type: "printer", slot: printerSlot },
    { type: "solder", slot: solderSlot },
  ];

  for (const task of tasks) {
    const current = existing.find((r) => r.studentId === studentId && r.type === task.type && !r.cancelled);

    if (!task.slot) {
      if (current) {
        await notion.pages.update({
          page_id: current.id,
          properties: {
            [TRAINING_CANCELLED_PROP]: { type: "checkbox", checkbox: true } as PagePropertyValueInput,
          },
        });
        if (task.type === "printer") result.printer = "cancelled";
        else result.solder = "cancelled";
      }
      continue;
    }

    const slotCount = existing.filter(
      (r) =>
        !r.cancelled &&
        r.date === task.slot!.date &&
        r.time === task.slot!.time &&
        !(current && r.id === current.id)
    ).length;
    if (slotCount >= TRAINING_CAPACITY_PER_SLOT) {
      throw new Error(
        `${task.slot.date} ${task.slot.time} (${TRAINING_TYPE_LABEL[task.type]}) 슬롯이 정원(${TRAINING_CAPACITY_PER_SLOT}명)이 다 찼습니다.`
      );
    }

    if (current && current.date === task.slot.date && current.time === task.slot.time) {
      if (task.type === "printer") result.printer = "unchanged";
      else result.solder = "unchanged";
      continue;
    }

    const properties: Record<string, PagePropertyValueInput> = {
      [TRAINING_DATE_PROP]: { type: "date", date: { start: task.slot.date } } as PagePropertyValueInput,
      [TRAINING_TIME_PROP]: { type: "select", select: { name: task.slot.time } } as PagePropertyValueInput,
      [TRAINING_TYPE_PROP]: {
        type: "select",
        select: { name: TRAINING_TYPE_LABEL[task.type] },
      } as PagePropertyValueInput,
      [TRAINING_CANCELLED_PROP]: { type: "checkbox", checkbox: false } as PagePropertyValueInput,
    };

    if (current) {
      await notion.pages.update({ page_id: current.id, properties });
    } else {
      const nameProp = Object.entries(schema).find(([, type]) => type === "title")?.[0] ?? "이름";
      properties[nameProp] = {
        type: "title",
        title: [{ type: "text", text: { content: name } }],
      } as PagePropertyValueInput;

      const studentIdType = schema[TRAINING_STUDENT_ID_PROP];
      if (studentIdType === "number") {
        const numeric = Number(studentId);
        properties[TRAINING_STUDENT_ID_PROP] = {
          type: "number",
          number: Number.isFinite(numeric) ? numeric : null,
        } as PagePropertyValueInput;
      } else {
        properties[TRAINING_STUDENT_ID_PROP] = {
          type: "rich_text",
          rich_text: [{ type: "text", text: { content: studentId } }],
        } as PagePropertyValueInput;
      }

      await notion.pages.create({
        parent: { data_source_id: dataSourceId, type: "data_source_id" },
        properties,
      });
    }

    if (task.type === "printer") result.printer = "registered";
    else result.solder = "registered";
  }

  return result;
}

// 이름+학번으로 본인의 현재 신청(취소되지 않은 것만) 내역을 조회합니다.
export async function getMyTrainingSessions(
  name: string,
  studentId: string
): Promise<{ type: TrainingType; date: string; time: string }[]> {
  const registrations = await getTrainingRegistrations();
  return registrations
    .filter((r) => r.name === name && r.studentId === studentId && !r.cancelled && r.type)
    .map((r) => ({ type: r.type as TrainingType, date: r.date, time: r.time }));
}

// 특정 종류(프린터기/인두기)의 신청을 취소합니다.
export async function cancelTrainingSession(
  name: string,
  studentId: string,
  type: TrainingType
): Promise<boolean> {
  const registrations = await getTrainingRegistrations();
  const target = registrations.find(
    (r) => r.name === name && r.studentId === studentId && r.type === type && !r.cancelled
  );
  if (!target) return false;

  await notion.pages.update({
    page_id: target.id,
    properties: {
      [TRAINING_CANCELLED_PROP]: { type: "checkbox", checkbox: true } as PagePropertyValueInput,
    },
  });
  return true;
}

// ---- 튜터링 신청 (새 워크스페이스 "2차 튜터링" 표) - 분반별 정원 28명, 초과 시 예비번호 ----
// 분반 목록은 아래 TUTORING_CLASSES에서 정합니다. 노션 "분반"(선택) 열에는 이 이름 그대로 저장됩니다.
// 예비 신청자는 입금 스크린샷을 받지 않으며, 확정 인원에서 빠진 자리가 생기면 예비 1번부터
// 자동으로 확정으로 올라갑니다(이때 "내 신청 확인"에서 입금 스크린샷을 올릴 수 있습니다).

const TUTORING_DATABASE_ID = "3f2672e627b1807ba703c4c0e664d54f";
export const TUTORING_CAPACITY_PER_CLASS = 28;
export const TUTORING_CLASSES = ["A반", "B반"];

export type TutoringClass = string;

type TutoringSchemaInfo = {
  titleProp: string;
  studentIdProp: string | null;
  studentIdType: string | null;
  classProp: string;
  classOptions: string[];
  paymentProp: string | null;
  teammatesProp: string | null;
  waitProp: string | null;
  waitType: string | null;
  rankProp: string | null;
  allProps: Record<string, string>;
};

let tutoringDataSourceIdCache: string | null = null;
let tutoringSchemaCache: { value: TutoringSchemaInfo; at: number } | null = null;
const TUTORING_SCHEMA_TTL_MS = 60 * 1000;

async function getTutoringDataSourceId(): Promise<string> {
  if (tutoringDataSourceIdCache) return tutoringDataSourceIdCache;
  tutoringDataSourceIdCache = await getDataSourceId(TUTORING_DATABASE_ID, notionNew);
  return tutoringDataSourceIdCache;
}

async function getTutoringSchema(): Promise<TutoringSchemaInfo> {
  if (tutoringSchemaCache && Date.now() - tutoringSchemaCache.at < TUTORING_SCHEMA_TTL_MS) {
    return tutoringSchemaCache.value;
  }
  const dataSourceId = await getTutoringDataSourceId();
  const dataSource = await notionNew.dataSources.retrieve({ data_source_id: dataSourceId });
  const props = ("properties" in dataSource ? dataSource.properties : {}) as Record<
    string,
    { type: string; select?: { options?: { name: string }[] } }
  >;
  const entries = Object.entries(props);
  const findBy = (pred: (name: string, type: string) => boolean) =>
    entries.find(([name, cfg]) => pred(name, cfg.type))?.[0] ?? null;

  const titleProp = findBy((_, t) => t === "title") ?? "이름";
  const studentIdProp = findBy((n, t) => n.includes("학번") && (t === "rich_text" || t === "number"));
  const classProp =
    findBy((n, t) => t === "select" && n.includes("반")) ?? findBy((_, t) => t === "select");
  if (!classProp) {
    throw new Error("튜터링 표에 분반(선택) 열이 없습니다.");
  }
  const classOptions = (props[classProp].select?.options ?? []).map((o) => o.name).filter(Boolean);
  const paymentProp =
    findBy((n, t) => t === "files" && n.includes("입금")) ?? findBy((_, t) => t === "files");
  const teammatesProp = findBy((n, t) => t === "rich_text" && n.replace(/\s/g, "").includes("팀원"));
  const waitProp = findBy(
    (n, t) => n.replace(/\s/g, "").includes("예비번호") && (t === "number" || t === "rich_text")
  );

  const rankProp = findBy((n, t) => n.replace(/\s/g, "") === "신청순위" && t === "number");

  const value: TutoringSchemaInfo = {
    titleProp,
    studentIdProp,
    studentIdType: studentIdProp ? props[studentIdProp].type : null,
    classProp,
    classOptions,
    paymentProp,
    teammatesProp,
    waitProp,
    waitType: waitProp ? props[waitProp].type : null,
    rankProp,
    allProps: Object.fromEntries(entries.map(([n, cfg]) => [n, cfg.type])),
  };
  tutoringSchemaCache = { value, at: Date.now() };
  return value;
}

export type TutoringRegistration = {
  id: string;
  name: string;
  studentId: string;
  className: TutoringClass | null;
  paid: boolean;
  logTime: string;
};

export async function getTutoringRegistrations(): Promise<TutoringRegistration[]> {
  const dataSourceId = await getTutoringDataSourceId();
  const schema = await getTutoringSchema();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionNew.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    pages.push(
      ...response.results.filter((item): item is PageObjectResponse =>
        isFullPage(item as { object: string } & Record<string, unknown>)
      )
    );
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages
    .map((page) => {
      const classProp = page.properties[schema.classProp];
      const className = classProp?.type === "select" ? (classProp.select?.name ?? null) : null;
      let studentId = "";
      const sidProp = schema.studentIdProp ? page.properties[schema.studentIdProp] : undefined;
      if (sidProp?.type === "rich_text") studentId = sidProp.rich_text.map((t) => t.plain_text).join("").trim();
      else if (sidProp?.type === "number") studentId = sidProp.number !== null ? String(sidProp.number) : "";
      const payProp = schema.paymentProp ? page.properties[schema.paymentProp] : undefined;
      const paid = payProp?.type === "files" ? payProp.files.length > 0 : false;
      return {
        id: page.id,
        name: getTitleText(page, schema.titleProp).trim(),
        studentId,
        className,
        paid,
        logTime: page.created_time,
      };
    })
    .filter((r) => r.name !== "" || r.studentId !== "");
}

// 신청 시각(페이지 생성 시각) 순으로 줄을 세웁니다. 앞에서 28명이 확정, 그 뒤는 예비입니다.
function rankTutoringClass(
  registrations: TutoringRegistration[],
  className: TutoringClass
): TutoringRegistration[] {
  return registrations
    .filter((r) => r.className === className)
    .sort((a, b) => {
      const diff = new Date(a.logTime).getTime() - new Date(b.logTime).getTime();
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
}

export type TutoringSubmitResult =
  | { status: "confirmed"; rank: number }
  | { status: "waitlisted"; waitNumber: number };

function tutoringResultFor(
  registrations: TutoringRegistration[],
  className: TutoringClass,
  pageId: string
): TutoringSubmitResult {
  const ranked = rankTutoringClass(registrations, className);
  const rank = ranked.findIndex((r) => r.id === pageId) + 1;
  return rank > 0 && rank <= TUTORING_CAPACITY_PER_CLASS
    ? { status: "confirmed", rank }
    : { status: "waitlisted", waitNumber: Math.max(1, rank - TUTORING_CAPACITY_PER_CLASS) };
}

export type TutoringClassStats = { name: TutoringClass; confirmedCount: number; waitingCount: number };

export async function getTutoringOverview(): Promise<{
  classes: TutoringClassStats[];
  hasTeammates: boolean;
}> {
  const schema = await getTutoringSchema();
  const registrations = await getTutoringRegistrations();
  const classes = TUTORING_CLASSES.map((name) => {
    const count = rankTutoringClass(registrations, name).length;
    return {
      name,
      confirmedCount: Math.min(count, TUTORING_CAPACITY_PER_CLASS),
      waitingCount: Math.max(0, count - TUTORING_CAPACITY_PER_CLASS),
    };
  });
  return { classes, hasTeammates: Boolean(schema.teammatesProp) };
}

export class TutoringUserError extends Error {}

// ---- 명단 자동 기입: 신청자는 이름/학번만 입력하고, 학과·학년·생년월일 등은 통합 명단에서 찾아 채웁니다 ----

function rosterPropText(prop: PageObjectResponse["properties"][string]): string {
  switch (prop.type) {
    case "title":
      return prop.title.map((t) => t.plain_text).join("").trim();
    case "rich_text":
      return prop.rich_text.map((t) => t.plain_text).join("").trim();
    case "number":
      return prop.number !== null ? String(prop.number) : "";
    case "select":
      return prop.select?.name ?? "";
    case "status":
      return prop.status?.name ?? "";
    case "multi_select":
      return prop.multi_select.map((o) => o.name).join(", ");
    case "date":
      return prop.date?.start ?? "";
    case "phone_number":
      return prop.phone_number ?? "";
    case "email":
      return prop.email ?? "";
    case "url":
      return prop.url ?? "";
    case "formula":
      if (prop.formula.type === "string") return prop.formula.string ?? "";
      if (prop.formula.type === "number") return prop.formula.number !== null ? String(prop.formula.number) : "";
      return "";
    default:
      return "";
  }
}

// "생년월일[예시:20051203]", "학년 (예: 2)" 같은 열 이름도 같은 열로 보도록 괄호 앞부분만 비교합니다.
function rosterKey(name: string): string {
  return name.split(/[[(]/)[0].replace(/\s/g, "");
}

// 통합 명단에서 이름+학번이 일치하는 행을 찾아 { 정규화된 열 이름: 값 } 으로 돌려줍니다.
async function findRosterRowValues(name: string, studentId: string): Promise<Record<string, string> | null> {
  const dataSourceId = await getDataSourceId(MEMBER_ROSTER_DATABASE_ID, notionNew);
  let cursor: string | undefined;
  do {
    const response = await notionNew.dataSources.query({ data_source_id: dataSourceId, start_cursor: cursor });
    for (const item of response.results) {
      if (!isFullPage(item as { object: string } & Record<string, unknown>)) continue;
      const page = item as PageObjectResponse;
      if (getTitleText(page, "이름").trim() !== name) continue;
      const values: Record<string, string> = {};
      let rowStudentId = "";
      for (const [key, prop] of Object.entries(page.properties)) {
        const text = rosterPropText(prop);
        if (key.startsWith("학번") || key === "Column 5") rowStudentId = text;
        if (text) values[rosterKey(key)] = text;
      }
      if (rowStudentId === studentId) return values;
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return null;
}

// 튜터링 표의 나머지 텍스트/숫자 열(학과, 학년, 생년월일 등)을 명단 값으로 채울 속성을 만듭니다.
async function buildTutoringRosterProps(
  schema: TutoringSchemaInfo,
  name: string,
  studentId: string
): Promise<Record<string, PagePropertyValueInput>> {
  const handled = new Set(
    [schema.titleProp, schema.studentIdProp, schema.classProp, schema.paymentProp, schema.teammatesProp, schema.waitProp, schema.rankProp].filter(
      (v): v is string => Boolean(v)
    )
  );
  const roster = await findRosterRowValues(name, studentId).catch((err) => {
    console.error("튜터링 명단 자동 기입 실패:", err);
    return null;
  });
  if (!roster) return {};

  const properties: Record<string, PagePropertyValueInput> = {};
  for (const [propName, type] of Object.entries(schema.allProps)) {
    if (handled.has(propName)) continue;
    const value = roster[rosterKey(propName)];
    if (!value) continue;
    if (type === "rich_text") {
      properties[propName] = {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: value } }],
      } as PagePropertyValueInput;
    } else if (type === "number") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        properties[propName] = { type: "number", number: numeric } as PagePropertyValueInput;
      }
    } else if (type === "select") {
      properties[propName] = { type: "select", select: { name: value } } as PagePropertyValueInput;
    }
  }
  return properties;
}

async function uploadTutoringPayment(pageId: string, paymentProp: string, paymentFile: File) {
  const ext = paymentFile.name.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase() || ".jpg";
  const filename = `payment-${Date.now()}${ext}`;
  const fileUpload = await notionNew.fileUploads.create({
    mode: "single_part",
    filename,
    content_type: paymentFile.type || "image/jpeg",
  });
  await notionNew.fileUploads.send({ file_upload_id: fileUpload.id, file: { filename, data: paymentFile } });
  await notionNew.pages.update({
    page_id: pageId,
    properties: {
      [paymentProp]: {
        type: "files",
        files: [{ type: "file_upload", file_upload: { id: fileUpload.id }, name: filename }],
      } as PagePropertyValueInput,
    },
  });
}

// 표에 "예비번호"/"신청순위" 열이 있으면 신청 시점 값을 기록해 둡니다(운영진 확인용).
async function writeTutoringWaitNumber(pageId: string, schema: TutoringSchemaInfo, result: TutoringSubmitResult) {
  const properties: Record<string, PagePropertyValueInput> = {};
  if (schema.waitProp) {
    const wait = result.status === "waitlisted" ? result.waitNumber : null;
    properties[schema.waitProp] =
      schema.waitType === "number"
        ? ({ type: "number", number: wait } as PagePropertyValueInput)
        : ({
            type: "rich_text",
            rich_text: wait ? [{ type: "text", text: { content: String(wait) } }] : [],
          } as PagePropertyValueInput);
  }
  if (schema.rankProp) {
    const rank =
      result.status === "confirmed" ? result.rank : TUTORING_CAPACITY_PER_CLASS + result.waitNumber;
    properties[schema.rankProp] = { type: "number", number: rank } as PagePropertyValueInput;
  }
  if (Object.keys(properties).length === 0) return;
  await notionNew.pages.update({ page_id: pageId, properties });
}

// 이름+학번으로 튜터링 분반을 신청합니다.
// - 정원(28명) 안이면 확정(입금 스크린샷 필수), 넘으면 예비번호로 등록(입금 받지 않음).
// - 같은 분반에 다시 제출하면 팀원/입금 스크린샷만 갱신합니다(예비→확정 전환 후 입금 제출용).
// - 다른 분반으로 바꾸면 기존 신청은 휴지통으로 보내고 새로 줄을 섭니다(순번 새치기 방지).
export async function submitTutoringRegistration(
  name: string,
  studentId: string,
  className: TutoringClass,
  paymentFile?: File,
  teammateNames?: string[]
): Promise<{ updated: boolean; result: TutoringSubmitResult }> {
  const dataSourceId = await getTutoringDataSourceId();
  const schema = await getTutoringSchema();
  if (!TUTORING_CLASSES.includes(className)) {
    throw new TutoringUserError("존재하지 않는 분반입니다.");
  }

  const existing = await getTutoringRegistrations();
  const match = existing.find((r) => r.studentId === studentId);
  if (match && match.name !== name) {
    throw new TutoringUserError("이미 다른 이름으로 신청된 학번입니다. 운영진에게 문의해 주세요.");
  }

  const teammateText = (teammateNames ?? []).map((n) => n.trim()).filter(Boolean).join(", ");
  const teammateProps: Record<string, PagePropertyValueInput> = {};
  if (schema.teammatesProp && teammateText) {
    teammateProps[schema.teammatesProp] = {
      type: "rich_text",
      rich_text: [{ type: "text", text: { content: teammateText } }],
    } as PagePropertyValueInput;
  }

  // 같은 분반 재제출: 순번 유지, 입금/팀원만 갱신
  if (match && match.className === className) {
    const result = tutoringResultFor(existing, className, match.id);
    if (Object.keys(teammateProps).length > 0) {
      await notionNew.pages.update({ page_id: match.id, properties: teammateProps });
    }
    if (result.status === "confirmed" && schema.paymentProp && !match.paid) {
      if (!paymentFile) throw new TutoringUserError("입금 확인 스크린샷을 첨부해 주세요.");
      await uploadTutoringPayment(match.id, schema.paymentProp, paymentFile);
    }
    await writeTutoringWaitNumber(match.id, schema, result);
    return { updated: true, result };
  }

  // 새 신청(또는 분반 변경): 지금 자리가 남아 있으면 확정 예정이므로 입금 스크린샷이 필요합니다.
  const others = existing.filter((r) => r.id !== match?.id);
  const willConfirm = rankTutoringClass(others, className).length < TUTORING_CAPACITY_PER_CLASS;
  if (willConfirm && schema.paymentProp && !paymentFile) {
    throw new TutoringUserError("입금 확인 스크린샷을 첨부해 주세요.");
  }

  if (match) {
    await notionNew.pages.update({ page_id: match.id, in_trash: true });
  }

  const rosterProps = await buildTutoringRosterProps(schema, name, studentId);
  const properties: Record<string, PagePropertyValueInput> = {
    ...rosterProps,
    ...teammateProps,
    [schema.titleProp]: {
      type: "title",
      title: [{ type: "text", text: { content: name } }],
    } as PagePropertyValueInput,
    [schema.classProp]: { type: "select", select: { name: className } } as PagePropertyValueInput,
  };
  if (schema.studentIdProp) {
    if (schema.studentIdType === "number") {
      const numeric = Number(studentId);
      properties[schema.studentIdProp] = {
        type: "number",
        number: Number.isFinite(numeric) ? numeric : null,
      } as PagePropertyValueInput;
    } else {
      properties[schema.studentIdProp] = {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: studentId } }],
      } as PagePropertyValueInput;
    }
  }

  const created = await notionNew.pages.create({
    parent: { data_source_id: dataSourceId, type: "data_source_id" },
    properties,
  });

  const result = tutoringResultFor(await getTutoringRegistrations(), className, created.id);
  // 동시에 신청이 몰려 예비로 밀린 경우엔 입금 스크린샷을 저장하지 않습니다.
  if (result.status === "confirmed" && paymentFile && schema.paymentProp) {
    await uploadTutoringPayment(created.id, schema.paymentProp, paymentFile);
  }
  await writeTutoringWaitNumber(created.id, schema, result);

  return { updated: Boolean(match), result };
}

// 이름+학번으로 본인의 현재 분반/순번을 조회합니다. 예비에서 확정으로 올라왔는데 아직 입금 전이면
// needsPayment가 true가 되어 팝업에서 입금 스크린샷을 올릴 수 있게 합니다.
export async function getTutoringStatus(
  name: string,
  studentId: string
): Promise<
  | { found: false }
  | { found: true; className: TutoringClass; result: TutoringSubmitResult; needsPayment: boolean }
> {
  const schema = await getTutoringSchema();
  const registrations = await getTutoringRegistrations();
  const match = registrations.find((r) => r.name === name && r.studentId === studentId && r.className);
  if (!match || !match.className) return { found: false };

  const result = tutoringResultFor(registrations, match.className, match.id);
  const needsPayment = result.status === "confirmed" && Boolean(schema.paymentProp) && !match.paid;
  return { found: true, className: match.className, result, needsPayment };
}

// 튜터링 신청 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_TUTORING_MODAL = true;

// 공지사항 중, 제목이 이 값과 정확히 일치하는 항목은 클릭 시 튜터링 신청 팝업을 엽니다.
export const TUTORING_NOTICE_TITLE = "튜터링 신청";

// ---- 아두이노·CAD 스터디 신청 - 각 20명 정원, 예비번호 (아두이노/CAD 각각 독립) ----

const STUDY_DATABASE_ID = "3db474b8fa7e8083b278c61550f570b0";
const STUDY_STUDENT_ID_PROP = "학번";
const STUDY_ARDUINO_PROP = "아두이노";
const STUDY_CAD_PROP = "CAD";
const STUDY_ARDUINO_RANK_PROP = "아두이노 신청 순위";
const STUDY_CAD_RANK_PROP = "CAD 신청 순위";

export const STUDY_CAPACITY_BY_PROGRAM: Record<StudyProgram, number> = { arduino: 20, cad: 30 };

// 모집 마감 시각 (한국 시간, 9/15 밤 12시 = 9/16 00:00). 이 시각 이후에는
// 팝업 자체와 공지사항 항목을 화면에서 아예 숨깁니다.
export const STUDY_DEADLINE = "2026-09-16T00:00:00+09:00";
export function isStudyPeriodOver(): boolean {
  return Date.now() >= new Date(STUDY_DEADLINE).getTime();
}

// 아두이노·CAD 스터디 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_STUDY_MODAL = true;

// 공지사항 중, 제목이 이 값과 정확히 일치하는 항목은 클릭 시 스터디 신청 팝업을 엽니다.
export const STUDY_NOTICE_TITLE = "아두이노·CAD 스터디 신청";

export type StudyProgram = "arduino" | "cad";

let studyDataSourceIdCache: string | null = null;
let studySchemaCache: Record<string, string> | null = null;

async function getStudyDataSourceId(): Promise<string> {
  if (studyDataSourceIdCache) return studyDataSourceIdCache;
  studyDataSourceIdCache = await getDataSourceId(STUDY_DATABASE_ID);
  return studyDataSourceIdCache;
}

async function getStudySchema(): Promise<Record<string, string>> {
  if (studySchemaCache) return studySchemaCache;
  const dataSourceId = await getStudyDataSourceId();
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const schema: Record<string, string> = {};
  if ("properties" in dataSource) {
    for (const [name, config] of Object.entries(dataSource.properties)) {
      schema[name] = config.type;
    }
  }
  studySchemaCache = schema;
  return schema;
}

function getStudyStudentId(page: PageObjectResponse): string {
  const prop = page.properties[STUDY_STUDENT_ID_PROP];
  if (!prop) return "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  if (prop.type === "number") return prop.number !== null ? String(prop.number) : "";
  return "";
}

export type StudyRegistration = {
  id: string;
  name: string;
  studentId: string;
  arduino: boolean;
  cad: boolean;
  logTime: string;
  arduinoRank: number | null;
  cadRank: number | null;
};

function getStudyRankValue(page: PageObjectResponse, propName: string): number | null {
  const prop = page.properties[propName];
  return prop?.type === "number" ? prop.number : null;
}

// 이름/학번이 둘 다 비어있는 빈 페이지는 실제 신청이 아니므로 제외합니다.
export async function getStudyRegistrations(): Promise<StudyRegistration[]> {
  const dataSourceId = await getStudyDataSourceId();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    pages.push(
      ...response.results.filter((item): item is PageObjectResponse =>
        isFullPage(item as { object: string } & Record<string, unknown>)
      )
    );
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages
    .map((page) => ({
      id: page.id,
      name: getTitleText(page, "이름"),
      studentId: getStudyStudentId(page),
      arduino: getCheckbox(page, STUDY_ARDUINO_PROP),
      cad: getCheckbox(page, STUDY_CAD_PROP),
      // 커스텀 날짜 속성은 이름/타입이 조금만 달라도 깨지는 문제가 있어서,
      // 노션 페이지 자체의 생성 시각(항상 정확, 절대 null 아님)을 순서 기준으로 씁니다.
      logTime: page.created_time,
      arduinoRank: getStudyRankValue(page, STUDY_ARDUINO_RANK_PROP),
      cadRank: getStudyRankValue(page, STUDY_CAD_RANK_PROP),
    }))
    .filter((r) => r.name.trim() !== "" || r.studentId.trim() !== "");
}

function rankStudyProgram(
  registrations: StudyRegistration[],
  program: StudyProgram
): StudyRegistration[] {
  return registrations
    .filter((r) => (program === "arduino" ? r.arduino : r.cad))
    .sort((a, b) => new Date(a.logTime).getTime() - new Date(b.logTime).getTime());
}

export type StudyProgramStats = { confirmedCount: number; waitingCount: number };

export async function getStudyStats(): Promise<Record<StudyProgram, StudyProgramStats>> {
  const registrations = await getStudyRegistrations();
  const result = {} as Record<StudyProgram, StudyProgramStats>;
  (["arduino", "cad"] as StudyProgram[]).forEach((p) => {
    const ranked = rankStudyProgram(registrations, p);
    const capacity = STUDY_CAPACITY_BY_PROGRAM[p];
    result[p] = {
      confirmedCount: Math.min(ranked.length, capacity),
      waitingCount: Math.max(0, ranked.length - capacity),
    };
  });
  return result;
}

export type StudyProgramResult =
  | { status: "not-applicable" }
  | { status: "confirmed"; rank: number }
  | { status: "waitlisted"; waitNumber: number };

function toStudyProgramResult(program: StudyProgram, rank: number): StudyProgramResult {
  if (rank <= 0) return { status: "not-applicable" };
  const capacity = STUDY_CAPACITY_BY_PROGRAM[program];
  return rank <= capacity
    ? { status: "confirmed", rank }
    : { status: "waitlisted", waitNumber: rank - capacity };
}

function toStudyDisplayRank(program: StudyProgram, rank: number): number {
  const capacity = STUDY_CAPACITY_BY_PROGRAM[program];
  return rank <= capacity ? rank : rank - capacity;
}

// 특정 스터디의 전체 순번을 다시 계산해서, 저장된 값과 다른 사람만 새 값으로 고쳐 씁니다.
// (동시에 여러 명이 신청하면 순번이 겹칠 수 있어서, 매 신청마다 전체를 다시 맞춰줍니다.)
async function resyncStudyProgramRanks(
  program: StudyProgram,
  registrations: StudyRegistration[],
  schema: Record<string, string>
): Promise<StudyRegistration[]> {
  const rankProp = program === "arduino" ? STUDY_ARDUINO_RANK_PROP : STUDY_CAD_RANK_PROP;
  const ranked = rankStudyProgram(registrations, program);
  if (schema[rankProp] !== "number") return ranked;

  await Promise.all(
    ranked.map((r, i) => {
      const displayRank = toStudyDisplayRank(program, i + 1);
      const currentValue = program === "arduino" ? r.arduinoRank : r.cadRank;
      if (currentValue === displayRank) return Promise.resolve();
      return notion.pages.update({
        page_id: r.id,
        properties: { [rankProp]: { type: "number", number: displayRank } as PagePropertyValueInput },
      });
    })
  );
  return ranked;
}

// 이름+학번으로 아두이노/CAD 스터디 신청을 등록·변경합니다 (체크 해제하면 그 항목만 취소 처리).
// 정원(20명)을 넘으면 신청을 막지 않고 예비번호로 등록됩니다.
export async function submitStudyRegistration(
  name: string,
  studentId: string,
  arduino: boolean,
  cad: boolean
): Promise<{ updated: boolean; arduino: StudyProgramResult; cad: StudyProgramResult }> {
  const dataSourceId = await getStudyDataSourceId();
  const schema = await getStudySchema();
  const existing = await getStudyRegistrations();
  const match = existing.find((r) => r.studentId === studentId);

  const properties: Record<string, PagePropertyValueInput> = {
    [STUDY_ARDUINO_PROP]: { type: "checkbox", checkbox: arduino } as PagePropertyValueInput,
    [STUDY_CAD_PROP]: { type: "checkbox", checkbox: cad } as PagePropertyValueInput,
  };

  let pageId: string;
  if (match) {
    pageId = match.id;
    await notion.pages.update({ page_id: pageId, properties });
  } else {
    const nameProp = Object.entries(schema).find(([, type]) => type === "title")?.[0] ?? "이름";
    properties[nameProp] = {
      type: "title",
      title: [{ type: "text", text: { content: name } }],
    } as PagePropertyValueInput;

    const studentIdType = schema[STUDY_STUDENT_ID_PROP];
    if (studentIdType === "number") {
      const numeric = Number(studentId);
      properties[STUDY_STUDENT_ID_PROP] = {
        type: "number",
        number: Number.isFinite(numeric) ? numeric : null,
      } as PagePropertyValueInput;
    } else {
      properties[STUDY_STUDENT_ID_PROP] = {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: studentId } }],
      } as PagePropertyValueInput;
    }

    const created = await notion.pages.create({
      parent: { data_source_id: dataSourceId, type: "data_source_id" },
      properties,
    });
    pageId = created.id;
  }

  // 체크 해제한 항목의 순위 값은 비웁니다 (다시 신청 안 함 처리).
  const clearProperties: Record<string, PagePropertyValueInput> = {};
  if (!arduino && schema[STUDY_ARDUINO_RANK_PROP] === "number") {
    clearProperties[STUDY_ARDUINO_RANK_PROP] = { type: "number", number: null } as PagePropertyValueInput;
  }
  if (!cad && schema[STUDY_CAD_RANK_PROP] === "number") {
    clearProperties[STUDY_CAD_RANK_PROP] = { type: "number", number: null } as PagePropertyValueInput;
  }
  if (Object.keys(clearProperties).length > 0) {
    await notion.pages.update({ page_id: pageId, properties: clearProperties });
  }

  // 전체를 다시 조회해서, 신청 순위가 실제 순서와 정확히 일치하도록 두 스터디 모두 다시 맞춰씁니다.
  const refreshed = await getStudyRegistrations();
  const rankedArduino = await resyncStudyProgramRanks("arduino", refreshed, schema);
  const rankedCad = await resyncStudyProgramRanks("cad", refreshed, schema);

  const arduinoRank = arduino ? rankedArduino.findIndex((r) => r.id === pageId) + 1 : 0;
  const cadRank = cad ? rankedCad.findIndex((r) => r.id === pageId) + 1 : 0;

  return {
    updated: Boolean(match),
    arduino: toStudyProgramResult("arduino", arduinoRank),
    cad: toStudyProgramResult("cad", cadRank),
  };
}

// 전체 신청 내역을 다시 조회해서 아두이노/CAD 신청 순위를 처음부터 다시 맞춰씁니다.
// (신청 폭주 등으로 이미 꼬여버린 기존 데이터를 한 번에 고칠 때 씁니다.)
export async function resyncAllStudyRanks(): Promise<void> {
  const schema = await getStudySchema();
  const registrations = await getStudyRegistrations();
  await resyncStudyProgramRanks("arduino", registrations, schema);
  await resyncStudyProgramRanks("cad", registrations, schema);
}

// 이름+학번으로 본인의 현재 신청 상태를 조회합니다.
export async function getStudyStatus(
  name: string,
  studentId: string
): Promise<{ found: false } | { found: true; arduino: StudyProgramResult; cad: StudyProgramResult }> {
  const registrations = await getStudyRegistrations();
  const match = registrations.find((r) => r.name === name && r.studentId === studentId);
  if (!match) return { found: false };

  const arduinoRank = match.arduino ? rankStudyProgram(registrations, "arduino").findIndex((r) => r.id === match.id) + 1 : 0;
  const cadRank = match.cad ? rankStudyProgram(registrations, "cad").findIndex((r) => r.id === match.id) + 1 : 0;

  return {
    found: true,
    arduino: toStudyProgramResult("arduino", arduinoRank),
    cad: toStudyProgramResult("cad", cadRank),
  };
}

// ---- IRC(국제로봇콘테스트) 참가 신청 - 정원 11명, 예비번호 ----

const IRC_DATABASE_ID = "3de474b8fa7e80888740fdf1ecd31ce7";
const IRC_STUDENT_ID_PROP = "학번";
const IRC_TEAMMATES_PROP = "팀원 희망";
const IRC_PAYMENT_PROP = "입금확인";
const IRC_RANK_PROP = "신청 순위";

export const IRC_CAPACITY = 11;

// 신청 마감 시각 (한국 시간, 9/19 밤 12시 = 9/20 00:00). 이 시각 이후에는
// 팝업 자체와 공지사항 항목을 화면에서 아예 숨깁니다.
export const IRC_DEADLINE = "2026-09-20T00:00:00+09:00";
export function isIrcPeriodOver(): boolean {
  return Date.now() >= new Date(IRC_DEADLINE).getTime();
}

// IRC 참가 신청 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_IRC_MODAL = true;

// 공지사항 중, 제목이 이 값과 정확히 일치하는 항목은 클릭 시 IRC 참가 신청 팝업을 엽니다.
export const IRC_NOTICE_TITLE = "IRC 참가 신청";

// IRC 신청도 위와 동일한 통합 명단(MEMBER_ROSTER_DATABASE_ID)으로 확인합니다.
// (예전엔 별도 ID였지만 실제로는 같은 표를 가리키고 있었습니다.)
// IRC 명단(이름+학번)에서 신청자를 확인합니다. 이름/학번이 둘 다 정확히 일치해야 합니다.
export async function isIrcMember(name: string, studentId: string): Promise<boolean> {
  const entries = await fetchRosterFromDatabase(MEMBER_ROSTER_DATABASE_ID);
  return entries.some((r) => r.name === name.trim() && r.studentId === studentId.trim());
}

let ircDataSourceIdCache: string | null = null;
let ircSchemaCache: Record<string, string> | null = null;

async function getIrcDataSourceId(): Promise<string> {
  if (ircDataSourceIdCache) return ircDataSourceIdCache;
  ircDataSourceIdCache = await getDataSourceId(IRC_DATABASE_ID);
  return ircDataSourceIdCache;
}

async function getIrcSchema(): Promise<Record<string, string>> {
  if (ircSchemaCache) return ircSchemaCache;
  const dataSourceId = await getIrcDataSourceId();
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const schema: Record<string, string> = {};
  if ("properties" in dataSource) {
    for (const [name, config] of Object.entries(dataSource.properties)) {
      schema[name] = config.type;
    }
  }
  ircSchemaCache = schema;
  return schema;
}

function getIrcStudentId(page: PageObjectResponse): string {
  const prop = page.properties[IRC_STUDENT_ID_PROP];
  if (!prop) return "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  if (prop.type === "number") return prop.number !== null ? String(prop.number) : "";
  return "";
}

function getIrcRankValue(page: PageObjectResponse): number | null {
  const prop = page.properties[IRC_RANK_PROP];
  return prop?.type === "number" ? prop.number : null;
}

export type IrcRegistration = {
  id: string;
  name: string;
  studentId: string;
  logTime: string;
  rank: number | null;
};

// 이름/학번이 둘 다 비어있는 빈 페이지는 실제 신청이 아니므로 제외합니다.
export async function getIrcRegistrations(): Promise<IrcRegistration[]> {
  const dataSourceId = await getIrcDataSourceId();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    pages.push(
      ...response.results.filter((item): item is PageObjectResponse =>
        isFullPage(item as { object: string } & Record<string, unknown>)
      )
    );
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages
    .map((page) => ({
      id: page.id,
      name: getTitleText(page, "이름"),
      studentId: getIrcStudentId(page),
      // 노션 페이지 자체의 생성 시각(항상 정확, 절대 null 아님)을 순서 기준으로 씁니다.
      logTime: page.created_time,
      rank: getIrcRankValue(page),
    }))
    .filter((r) => r.name.trim() !== "" || r.studentId.trim() !== "");
}

function rankIrcRegistrations(registrations: IrcRegistration[]): IrcRegistration[] {
  return [...registrations].sort((a, b) => new Date(a.logTime).getTime() - new Date(b.logTime).getTime());
}

export type IrcStats = { confirmedCount: number; waitingCount: number };

export async function getIrcStats(): Promise<IrcStats> {
  const ranked = rankIrcRegistrations(await getIrcRegistrations());
  return {
    confirmedCount: Math.min(ranked.length, IRC_CAPACITY),
    waitingCount: Math.max(0, ranked.length - IRC_CAPACITY),
  };
}

export type IrcSubmitResult =
  | { status: "confirmed"; rank: number }
  | { status: "waitlisted"; waitNumber: number };

function toIrcResult(rank: number): IrcSubmitResult {
  return rank <= IRC_CAPACITY
    ? { status: "confirmed", rank }
    : { status: "waitlisted", waitNumber: rank - IRC_CAPACITY };
}

function toIrcDisplayRank(rank: number): number {
  return rank <= IRC_CAPACITY ? rank : rank - IRC_CAPACITY;
}

// 전체 신청 순번을 다시 계산해서, 저장된 값과 다른 사람만 새 값으로 고쳐 씁니다.
// (동시에 여러 명이 신청하면 순번이 겹칠 수 있어서, 매 신청마다 전체를 다시 맞춰줍니다.)
async function resyncIrcRanks(
  registrations: IrcRegistration[],
  schema: Record<string, string>
): Promise<IrcRegistration[]> {
  const ranked = rankIrcRegistrations(registrations);
  if (schema[IRC_RANK_PROP] !== "number") return ranked;

  await Promise.all(
    ranked.map((r, i) => {
      const displayRank = toIrcDisplayRank(i + 1);
      if (r.rank === displayRank) return Promise.resolve();
      return notion.pages.update({
        page_id: r.id,
        properties: { [IRC_RANK_PROP]: { type: "number", number: displayRank } as PagePropertyValueInput },
      });
    })
  );
  return ranked;
}

// 이름+학번으로 IRC 참가를 신청/변경합니다. 정원(11명)을 넘으면 예비번호로 등록됩니다.
export async function submitIrcRegistration(
  name: string,
  studentId: string,
  teammateNames: string[],
  paymentFile?: File
): Promise<{ updated: boolean; result: IrcSubmitResult }> {
  const dataSourceId = await getIrcDataSourceId();
  const schema = await getIrcSchema();
  const existing = await getIrcRegistrations();
  const match = existing.find((r) => r.studentId === studentId);

  const teammateText = teammateNames.map((n) => n.trim()).filter(Boolean).join(", ");
  const properties: Record<string, PagePropertyValueInput> = {};
  if (schema[IRC_TEAMMATES_PROP] === "rich_text") {
    properties[IRC_TEAMMATES_PROP] = {
      type: "rich_text",
      rich_text: teammateText ? [{ type: "text", text: { content: teammateText } }] : [],
    } as PagePropertyValueInput;
  }

  let pageId: string;
  if (match) {
    pageId = match.id;
    if (Object.keys(properties).length > 0) {
      await notion.pages.update({ page_id: pageId, properties });
    }
  } else {
    const nameProp = Object.entries(schema).find(([, type]) => type === "title")?.[0] ?? "이름";
    properties[nameProp] = {
      type: "title",
      title: [{ type: "text", text: { content: name } }],
    } as PagePropertyValueInput;

    const studentIdType = schema[IRC_STUDENT_ID_PROP];
    if (studentIdType === "number") {
      const numeric = Number(studentId);
      properties[IRC_STUDENT_ID_PROP] = {
        type: "number",
        number: Number.isFinite(numeric) ? numeric : null,
      } as PagePropertyValueInput;
    } else {
      properties[IRC_STUDENT_ID_PROP] = {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: studentId } }],
      } as PagePropertyValueInput;
    }

    const created = await notion.pages.create({
      parent: { data_source_id: dataSourceId, type: "data_source_id" },
      properties,
    });
    pageId = created.id;
  }

  if (paymentFile && schema[IRC_PAYMENT_PROP] === "files") {
    const ext = paymentFile.name.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase() || ".jpg";
    const filename = `payment-${Date.now()}${ext}`;
    const fileUpload = await notion.fileUploads.create({
      mode: "single_part",
      filename,
      content_type: paymentFile.type || "image/jpeg",
    });
    await notion.fileUploads.send({ file_upload_id: fileUpload.id, file: { filename, data: paymentFile } });
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [IRC_PAYMENT_PROP]: {
          type: "files",
          files: [{ type: "file_upload", file_upload: { id: fileUpload.id }, name: filename }],
        } as PagePropertyValueInput,
      },
    });
  }

  const refreshed = await getIrcRegistrations();
  const ranked = await resyncIrcRanks(refreshed, schema);
  const rank = ranked.findIndex((r) => r.id === pageId) + 1;

  return { updated: Boolean(match), result: toIrcResult(rank) };
}

// 전체 신청 내역을 다시 조회해서 순번을 처음부터 다시 맞춰씁니다 (동시 신청으로 꼬인 데이터 정리용).
export async function resyncAllIrcRanks(): Promise<void> {
  const schema = await getIrcSchema();
  const registrations = await getIrcRegistrations();
  await resyncIrcRanks(registrations, schema);
}

// 이름+학번으로 본인의 현재 신청 상태를 조회합니다.
export async function getIrcStatus(
  name: string,
  studentId: string
): Promise<{ found: false } | { found: true; result: IrcSubmitResult }> {
  const registrations = await getIrcRegistrations();
  const match = registrations.find((r) => r.name === name && r.studentId === studentId);
  if (!match) return { found: false };

  const ranked = rankIrcRegistrations(registrations);
  const rank = ranked.findIndex((r) => r.id === match.id) + 1;

  return { found: true, result: toIrcResult(rank) };
}

// ---- MT 신청 - 정원 50명, 초과 시 예비번호(예비 1, 예비 2 ...) ----

const MT_DATABASE_ID = "3dd5de02765c80219db3e00bc24d85c1";
const MT_STUDENT_ID_PROP = "학번";
const MT_PHONE_PROP = "전화번호";
const MT_RANK_PROP = "순번";

export const MT_CAPACITY = 50;

// MT 신청 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_MT_MODAL = false;

// 공지사항 중, 제목이 이 값과 정확히 일치하는 항목은 클릭 시 MT 신청 팝업을 엽니다.
export const MT_NOTICE_TITLE = "MT 신청";

// MT 신청 시 동아리원 확인용 명단 ("26-2 전체 인원 정보" 데이터베이스)
const MT_ROSTER_DATABASE_ID = "3de5de02765c8049aed0c7ce638746da";
const MT_ROSTER_TITLE_PROP = "제목";
const MT_ROSTER_STUDENT_ID_PROP = "학번";
const MT_ROSTER_CONTACT_PROP = "연락처";

let mtRosterDataSourceIdCache: string | null = null;

async function getMtRosterDataSourceId(): Promise<string> {
  if (mtRosterDataSourceIdCache) return mtRosterDataSourceIdCache;
  mtRosterDataSourceIdCache = await getDataSourceId(MT_ROSTER_DATABASE_ID, mtNotion);
  return mtRosterDataSourceIdCache;
}

function getMtRosterContact(page: PageObjectResponse): string {
  const prop = page.properties[MT_ROSTER_CONTACT_PROP];
  if (!prop) return "";
  if (prop.type === "phone_number") return prop.phone_number ?? "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  return "";
}

// 이름+학번이 "26-2 전체 인원 정보" 명단에 있는지 확인하고, 있으면 등록된 연락처를 함께 돌려줍니다.
// (MT 신청 폼에서 전화번호를 따로 입력받지 않고, 이 명단의 연락처를 그대로 사용합니다.)
export async function findMtRosterMember(
  name: string,
  studentId: string
): Promise<{ found: true; phone: string } | { found: false }> {
  const dataSourceId = await getMtRosterDataSourceId();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await mtNotion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    pages.push(
      ...response.results.filter((item): item is PageObjectResponse =>
        isFullPage(item as { object: string } & Record<string, unknown>)
      )
    );
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const match = pages.find((page) => {
    const rosterName = getTitleText(page, MT_ROSTER_TITLE_PROP).trim();
    const idProp = page.properties[MT_ROSTER_STUDENT_ID_PROP];
    const rosterStudentId =
      idProp?.type === "number" && idProp.number !== null ? String(idProp.number) : "";
    return rosterName === name.trim() && rosterStudentId === studentId.trim();
  });

  if (!match) return { found: false };
  return { found: true, phone: getMtRosterContact(match) };
}

let mtDataSourceIdCache: string | null = null;
let mtSchemaCache: Record<string, string> | null = null;

async function getMtDataSourceId(): Promise<string> {
  if (mtDataSourceIdCache) return mtDataSourceIdCache;
  mtDataSourceIdCache = await getDataSourceId(MT_DATABASE_ID, mtNotion);
  return mtDataSourceIdCache;
}

async function getMtSchema(): Promise<Record<string, string>> {
  if (mtSchemaCache) return mtSchemaCache;
  const dataSourceId = await getMtDataSourceId();
  const dataSource = await mtNotion.dataSources.retrieve({ data_source_id: dataSourceId });
  const schema: Record<string, string> = {};
  if ("properties" in dataSource) {
    for (const [name, config] of Object.entries(dataSource.properties)) {
      schema[name] = config.type;
    }
  }
  mtSchemaCache = schema;
  return schema;
}

function getMtStudentId(page: PageObjectResponse): string {
  const prop = page.properties[MT_STUDENT_ID_PROP];
  if (!prop) return "";
  if (prop.type === "number") return prop.number !== null ? String(prop.number) : "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  return "";
}

function getMtPhone(page: PageObjectResponse): string {
  const prop = page.properties[MT_PHONE_PROP];
  if (!prop) return "";
  if (prop.type === "phone_number") return prop.phone_number ?? "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("").trim();
  return "";
}

function getMtRankValue(page: PageObjectResponse): number | null {
  const prop = page.properties[MT_RANK_PROP];
  return prop?.type === "number" ? prop.number : null;
}

export type MtRegistration = {
  id: string;
  name: string;
  studentId: string;
  phone: string;
  logTime: string;
  rank: number | null;
};

// 이름/학번이 둘 다 비어있는 빈 페이지는 실제 신청이 아니므로 제외합니다.
export async function getMtRegistrations(): Promise<MtRegistration[]> {
  const dataSourceId = await getMtDataSourceId();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await mtNotion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    pages.push(
      ...response.results.filter((item): item is PageObjectResponse =>
        isFullPage(item as { object: string } & Record<string, unknown>)
      )
    );
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages
    .map((page) => ({
      id: page.id,
      name: getTitleText(page, "이름"),
      studentId: getMtStudentId(page),
      phone: getMtPhone(page),
      // 커스텀 날짜 속성 대신, 노션 페이지 자체의 생성 시각(항상 정확, 절대 null 아님)을
      // 신청 순서 기준으로 씁니다.
      logTime: page.created_time,
      rank: getMtRankValue(page),
    }))
    .filter((r) => r.name.trim() !== "" || r.studentId.trim() !== "");
}

function rankMtRegistrations(registrations: MtRegistration[]): MtRegistration[] {
  return [...registrations].sort((a, b) => new Date(a.logTime).getTime() - new Date(b.logTime).getTime());
}

export type MtStats = { confirmedCount: number; waitingCount: number };

export async function getMtStats(): Promise<MtStats> {
  const ranked = rankMtRegistrations(await getMtRegistrations());
  return {
    confirmedCount: Math.min(ranked.length, MT_CAPACITY),
    waitingCount: Math.max(0, ranked.length - MT_CAPACITY),
  };
}

export type MtSubmitResult =
  | { status: "confirmed"; rank: number }
  | { status: "waitlisted"; waitNumber: number };

function toMtSubmitResult(absoluteRank: number): MtSubmitResult {
  return absoluteRank <= MT_CAPACITY
    ? { status: "confirmed", rank: absoluteRank }
    : { status: "waitlisted", waitNumber: absoluteRank - MT_CAPACITY };
}

// 전체 신청 내역을 순서대로 다시 매겨서, "순번" 값이 실제 순서와 다른 사람만 새 값으로 고쳐 씁니다.
// (정원 50명까지는 1~50, 그 이후는 51, 52...로 저장하고, 화면에는 "예비 1, 예비 2"로 표시합니다.)
async function resyncMtRanks(
  registrations: MtRegistration[],
  schema: Record<string, string>
): Promise<MtRegistration[]> {
  const ranked = rankMtRegistrations(registrations);
  if (schema[MT_RANK_PROP] !== "number") return ranked;

  await Promise.all(
    ranked.map((r, i) => {
      const absoluteRank = i + 1;
      if (r.rank === absoluteRank) return Promise.resolve();
      return mtNotion.pages.update({
        page_id: r.id,
        properties: { [MT_RANK_PROP]: { type: "number", number: absoluteRank } as PagePropertyValueInput },
      });
    })
  );
  return ranked;
}

// 이름+학번으로 MT 신청을 등록합니다. 정원(50명) 안에 들면 확정, 넘으면 예비번호로 등록됩니다.
// (이미 신청한 사람이 다시 신청하면 전화번호만 갱신하고 순번은 그대로 유지됩니다.)
export async function submitMtRegistration(
  name: string,
  studentId: string,
  phone: string
): Promise<{ updated: boolean; result: MtSubmitResult }> {
  const dataSourceId = await getMtDataSourceId();
  const schema = await getMtSchema();
  const existing = await getMtRegistrations();
  const match = existing.find((r) => r.studentId === studentId);

  const properties: Record<string, PagePropertyValueInput> = {};
  if (schema[MT_PHONE_PROP] === "phone_number") {
    properties[MT_PHONE_PROP] = { type: "phone_number", phone_number: phone } as PagePropertyValueInput;
  } else {
    properties[MT_PHONE_PROP] = {
      type: "rich_text",
      rich_text: [{ type: "text", text: { content: phone } }],
    } as PagePropertyValueInput;
  }

  let pageId: string;
  if (match) {
    pageId = match.id;
    await mtNotion.pages.update({ page_id: pageId, properties });
  } else {
    const nameProp = Object.entries(schema).find(([, type]) => type === "title")?.[0] ?? "이름";
    properties[nameProp] = {
      type: "title",
      title: [{ type: "text", text: { content: name } }],
    } as PagePropertyValueInput;

    const studentIdType = schema[MT_STUDENT_ID_PROP];
    if (studentIdType === "number") {
      const numeric = Number(studentId);
      properties[MT_STUDENT_ID_PROP] = {
        type: "number",
        number: Number.isFinite(numeric) ? numeric : null,
      } as PagePropertyValueInput;
    } else {
      properties[MT_STUDENT_ID_PROP] = {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: studentId } }],
      } as PagePropertyValueInput;
    }

    const created = await mtNotion.pages.create({
      parent: { data_source_id: dataSourceId, type: "data_source_id" },
      properties,
    });
    pageId = created.id;
  }

  const refreshed = await getMtRegistrations();
  const ranked = await resyncMtRanks(refreshed, schema);
  const absoluteRank = ranked.findIndex((r) => r.id === pageId) + 1;

  return { updated: Boolean(match), result: toMtSubmitResult(absoluteRank) };
}
