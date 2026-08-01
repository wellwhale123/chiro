export type CalendarCell = { dateStr: string; day: number } | null;

// year/month(1-12) 기준으로 6주 x 7일 형태의 달력 그리드를 만듭니다.
export function buildMonthGrid(year: number, month: number): CalendarCell[][] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=일요일
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ dateStr: `${year}-${mm}-${dd}`, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// 한국(서울) 시간 기준 오늘 날짜
export function getTodayKST(): { year: number; month: number; day: number; dateStr: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);

  return { year, month, day, dateStr: `${map.year}-${map.month}-${map.day}` };
}
