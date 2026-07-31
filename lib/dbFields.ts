export type DbKey = "schedule" | "activities" | "awards" | "projects";
export type FieldKey = "title" | "date" | "detail" | "tag" | "photo";

export const DB_LABELS: Record<DbKey, string> = {
  schedule: "일정",
  activities: "활동",
  awards: "수상",
  projects: "프로젝트",
};

export const DB_FIELDS: Record<DbKey, FieldKey[]> = {
  schedule: ["title", "date"],
  activities: ["title", "date", "detail", "photo"],
  awards: ["title", "date", "detail", "photo"],
  projects: ["title", "tag", "detail", "photo"],
};

export const FIELD_LABELS: Record<FieldKey, string> = {
  title: "제목",
  date: "날짜",
  detail: "상세 내용",
  tag: "태그",
  photo: "사진",
};
