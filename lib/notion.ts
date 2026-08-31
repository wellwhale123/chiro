import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 사용자가 안내받은 대로 만든 4개 데이터베이스 ID (비밀정보 아님, 페이지 URL에서 그대로 가져온 값)
export const DATABASE_IDS = {
  schedule: "3ae474b8fa7e80759531ffe07be1e136",
  awards: "3ae474b8fa7e80c78901df494924ef1f",
  activities: "3ae474b8fa7e8060be72c888eec5d5fd",
  projects: "3ae474b8fa7e80f1bcfdf75ae74f7c49",
  notices: "3b0474b8fa7e80c7aa71d4e54f3b9084",
} as const;

export type DatabaseKey = keyof typeof DATABASE_IDS;

// 데이터베이스 ID -> 데이터소스 ID 캐시 (같은 서버 인스턴스 내에서 반복 조회를 피하기 위함)
const dataSourceIdCache = new Map<string, string>();

async function getDataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceIdCache.get(databaseId);
  if (cached) return cached;

  const database = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in database) || database.data_sources.length === 0) {
    throw new Error(`데이터베이스(${databaseId})에서 데이터소스를 찾을 수 없습니다.`);
  }

  const dataSourceId = database.data_sources[0].id;
  dataSourceIdCache.set(databaseId, dataSourceId);
  return dataSourceId;
}

export async function getDataSourceIdForKey(key: DatabaseKey): Promise<string> {
  return getDataSourceId(DATABASE_IDS[key]);
}

function isFullPage(
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
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      sorts,
    });
    return response.results.filter(isFullPage);
  } catch {
    // 정렬 속성이 없는 등의 이유로 실패하면, 정렬 없이 한 번 더 시도합니다.
    const response = await notion.dataSources.query({ data_source_id: dataSourceId });
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

const OFFICERS_DATABASE_ID = "3af474b8fa7e80e29418d80345b5d980";
let officersDataSourceIdCache: string | null = null;

async function getOfficersDataSourceId(): Promise<string> {
  if (officersDataSourceIdCache) return officersDataSourceIdCache;
  officersDataSourceIdCache = await getDataSourceId(OFFICERS_DATABASE_ID);
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
  const response = await notion.dataSources.query({ data_source_id: dataSourceId });
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

const CLUB_INTRO_DATABASE_ID = "3af474b8fa7e8082b74fc4377697c4d5";
let clubIntroDataSourceIdCache: string | null = null;

async function getClubIntroDataSourceId(): Promise<string> {
  if (clubIntroDataSourceIdCache) return clubIntroDataSourceIdCache;
  clubIntroDataSourceIdCache = await getDataSourceId(CLUB_INTRO_DATABASE_ID);
  return clubIntroDataSourceIdCache;
}

export type ClubIntroSection = {
  id: string;
  name: string;
  content: string;
};

export async function getClubIntroSections(): Promise<ClubIntroSection[]> {
  const dataSourceId = await getClubIntroDataSourceId();
  const response = await notion.dataSources.query({ data_source_id: dataSourceId });
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

const ALUMNI_DATABASE_ID = "3af474b8fa7e805ba835d66427bed0cd";
let alumniDataSourceIdCache: string | null = null;

async function getAlumniDataSourceId(): Promise<string> {
  if (alumniDataSourceIdCache) return alumniDataSourceIdCache;
  alumniDataSourceIdCache = await getDataSourceId(ALUMNI_DATABASE_ID);
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
  const response = await notion.dataSources.query({ data_source_id: dataSourceId });
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

// ---- 동아리원 명단 (신규등록 + 재등록 응답 시트를 노션으로 가져온 데이터베이스 2개) ----
// 개강총회 신청 시 "동아리 사람인지" 판단하는 기준으로 사용합니다 (이름+학번이 둘 다 일치해야 함).

const MEMBER_ROSTER_DATABASE_IDS = [
  "3c6474b8fa7e80cbb5bbe77d224e79d0", // CHIRO 26-2 신규등록 신청서(응답)
  "3c6474b8fa7e80948d66c7727a7a0e58", // CHIRO 26-2 재등록 신청서(응답)
];

type RosterEntry = { name: string; studentId: string };

const rosterCache = new Map<string, { entries: RosterEntry[]; fetchedAt: number }>();
const ROSTER_CACHE_TTL_MS = 60 * 1000; // 1분마다 새로고침

async function fetchRosterFromDatabase(databaseId: string): Promise<RosterEntry[]> {
  const cached = rosterCache.get(databaseId);
  if (cached && Date.now() - cached.fetchedAt < ROSTER_CACHE_TTL_MS) {
    return cached.entries;
  }

  const dataSourceId = await getDataSourceId(databaseId);
  const entries: RosterEntry[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    const pages = response.results.filter((item): item is PageObjectResponse =>
      isFullPage(item as { object: string } & Record<string, unknown>)
    );

    for (const page of pages) {
      const name = getRichText(page, "성명").trim();
      let studentId = "";
      for (const [key, prop] of Object.entries(page.properties)) {
        // 구글폼 임포트 특성상 속성 이름이 "학번 (예: 20261234)"처럼 예시가 붙어있을 수 있어
        // "학번"으로 시작하는 속성을 찾아서 사용합니다.
        if (!key.startsWith("학번")) continue;
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

// 신규등록 + 재등록 명단을 합쳐서, 이름과 학번이 정확히 일치하는 동아리원인지 확인합니다.
export async function isClubMember(name: string, studentId: string): Promise<boolean> {
  const rosters = await Promise.all(MEMBER_ROSTER_DATABASE_IDS.map(fetchRosterFromDatabase));
  const combined = rosters.flat();
  return combined.some((r) => r.name === name && r.studentId === studentId);
}

// 개강총회 신청 팝업 표시 여부. 코드는 그대로 두고 이 값만 true/false로 바꿔서 껐다 켤 수 있습니다.
export const SHOW_OPENING_MODAL = true;

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
// (임시 테스트: 잠깐 52명으로 낮춰둠 — 테스트 끝나면 75로 되돌려야 함)
export const AFTER_PARTY1_CAPACITY = 52;

// 접수 시작 시각 (한국 시간 기준). 이 시각 이전에는 신청을 받지 않습니다.
export const OPENING_START_TIME = "2026-08-24T09:25:00+09:00";

// 접수 마감 시각 (한국 시간 기준, 9/1 밤 12시 = 9/2 00:00). 이 시각 이후에는
// 팝업 자체와 공지사항 항목을 화면에서 아예 숨깁니다.
export const OPENING_DEADLINE = "2026-09-02T00:00:00+09:00";

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
  logTime: string | null;
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
      const logProp = page.properties[OPENING_LOG_PROP];
      const logTime = logProp?.type === "date" ? (logProp.date?.start ?? null) : null;
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
    .sort((a, b) => {
      const ta = a.logTime ? new Date(a.logTime).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.logTime ? new Date(b.logTime).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
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
    try {
      await sendMail({
        to: r.waitlistEmail,
        subject: "[CHIRO] 뒷풀이 1차 대기가 풀렸습니다",
        html: `
          <div style="font-family: sans-serif; line-height: 1.6;">
            <p>${r.name}님, 대기 중이던 뒷풀이 1차 자리가 나서 참석이 확정되었습니다.</p>
            <p style="color: #64748b; font-size: 13px;">별도로 하실 일은 없습니다. 문의사항은 운영진에게 연락해 주세요.</p>
          </div>
        `,
      });
      await notion.pages.update({
        page_id: r.id,
        properties: {
          [OPENING_WAITLIST_NOTIFIED_PROP]: { type: "checkbox", checkbox: true } as PagePropertyValueInput,
        },
      });
    } catch (error) {
      console.error("대기자 알림 메일 발송 실패:", error);
      // 발송 실패 시 notified를 켜지 않아서 다음 기회에 다시 시도됩니다.
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

  if (schema[OPENING_LOG_PROP] === "date") {
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
