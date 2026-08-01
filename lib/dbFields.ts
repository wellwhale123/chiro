export type DbKey = "schedule" | "activities" | "awards" | "projects";
export type FieldKey = "title" | "date" | "startDate" | "endDate" | "detail" | "tag" | "photo";

export const DB_LABELS: Record<DbKey, string> = {
  schedule: "일정",
  activities: "활동",
  awards: "수상",
  projects: "프로젝트",
};

export const DB_FIELDS: Record<DbKey, FieldKey[]> = {
  schedule: ["title", "startDate", "endDate", "detail"],
  activities: ["title", "startDate", "endDate", "detail", "photo"],
  awards: ["title", "date", "detail", "photo"],
  projects: ["title", "startDate", "endDate", "tag", "detail", "photo"],
};

export const FIELD_LABELS: Record<FieldKey, string> = {
  title: "제목",
  date: "날짜",
  startDate: "시작일",
  endDate: "종료일",
  detail: "상세 내용",
  tag: "태그",
  photo: "사진",
};
