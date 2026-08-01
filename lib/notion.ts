import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 사용자가 안내받은 대로 만든 4개 데이터베이스 ID (비밀정보 아님, 페이지 URL에서 그대로 가져온 값)
export const DATABASE_IDS = {
  schedule: "3ae474b8fa7e80759531ffe07be1e136",
  awards: "3ae474b8fa7e80c78901df494924ef1f",
  activities: "3ae474b8fa7e8060be72c888eec5d5fd",
  projects: "3ae474b8fa7e80f1bcfdf75ae74f7c49",
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
  { title: string; date?: string; startDate?: string; endDate?: string; detail?: string; tag?: string }
> = {
  schedule: { title: "제목", startDate: "시작일", endDate: "종료일", detail: "상세 내용" },
  activities: { title: "제목", startDate: "시작일", endDate: "종료일", detail: "상세 내용" },
  awards: { title: "제목", date: "날짜", detail: "상세 내용" },
  projects: { title: "제목", startDate: "시작일", endDate: "종료일", tag: "태그", detail: "상세내용" },
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
  const photoUrls = getFileUrls(page);

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
  value: string | number | null
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
  function setIfExists(propName: string | undefined, value: string | null) {
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
