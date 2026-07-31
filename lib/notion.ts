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
  options?: { sortProperty?: string }
): Promise<PageObjectResponse[]> {
  const databaseId = DATABASE_IDS[key];
  const dataSourceId = await getDataSourceId(databaseId);

  const sorts = options?.sortProperty
    ? [{ property: options.sortProperty, direction: "ascending" as const }]
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

export function getNumber(page: PageObjectResponse, propName = "순서"): number {
  const prop = page.properties[propName];
  if (prop?.type === "number") {
    return prop.number ?? 0;
  }
  return 0;
}

export function getFirstFileUrl(page: PageObjectResponse, propName = "사진"): string | null {
  const prop = page.properties[propName];
  if (prop?.type !== "files" || prop.files.length === 0) return null;

  const file = prop.files[0];
  if (file.type === "external") return file.external.url;
  if (file.type === "file") return file.file.url;
  return null;
}

export function getTagLabel(page: PageObjectResponse, propName = "태그"): string {
  const prop = page.properties[propName];
  if (!prop) return "";
  if (prop.type === "multi_select") return prop.multi_select.map((s) => s.name).join(" · ");
  if (prop.type === "select") return prop.select?.name ?? "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("");
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

// ---- 항목 생성/수정 (관리자 모드) ----

// 각 데이터베이스에서 어떤 필드를 어떤 실제 속성명에 매핑할지 정의
export const FIELD_CONFIG: Record<
  DatabaseKey,
  { title: string; date?: string; detail?: string; tag?: string; order?: string }
> = {
  schedule: { title: "제목", date: "날짜", order: "순서" },
  activities: { title: "제목", date: "날짜", detail: "상세 내용", order: "순서" },
  awards: { title: "제목", date: "날짜", detail: "상세 내용", order: "순서" },
  projects: { title: "제목", tag: "태그", detail: "상세내용" },
};

export type ItemFormFields = {
  title: string;
  date?: string;
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
  fields: Partial<ItemFormFields>,
  options?: { assignOrder?: boolean }
): Promise<Record<string, PagePropertyValueInput>> {
  const config = FIELD_CONFIG[key];
  const schema = await getPropertySchema(key);
  const properties: Record<string, PagePropertyValueInput> = {};

  if (fields.title !== undefined) {
    const payload = buildPropertyPayload(schema[config.title] ?? "title", fields.title);
    if (payload) properties[config.title] = payload;
  }

  if (config.date && fields.date !== undefined) {
    const payload = buildPropertyPayload(schema[config.date] ?? "date", fields.date || null);
    if (payload) properties[config.date] = payload;
  }

  if (config.detail && fields.detail !== undefined) {
    const payload = buildPropertyPayload(schema[config.detail] ?? "rich_text", fields.detail);
    if (payload) properties[config.detail] = payload;
  }

  if (config.tag && fields.tag !== undefined) {
    const payload = buildPropertyPayload(schema[config.tag] ?? "rich_text", fields.tag);
    if (payload) properties[config.tag] = payload;
  }

  if (options?.assignOrder && config.order) {
    const existing = await queryDatabase(key);
    const maxOrder = existing.reduce((max, page) => Math.max(max, getNumber(page, config.order!)), 0);
    const payload = buildPropertyPayload("number", maxOrder + 1);
    if (payload) properties[config.order] = payload;
  }

  return properties;
}

export async function createNotionItem(
  key: DatabaseKey,
  fields: ItemFormFields
): Promise<string> {
  const dataSourceId = await getDataSourceIdForKey(key);
  const properties = await buildPropertiesFromFields(key, fields, { assignOrder: true });

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
