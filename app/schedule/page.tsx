import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { getAllItems, type NormalizedItem } from "@/lib/notion";
import { getHolidayName } from "@/lib/holidays";
import { buildMonthGrid, getTodayKST, type CalendarCell } from "@/lib/calendar";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { AddItemButton } from "../components/AddItemButton";

export const revalidate = 60;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_LANES = 4;

type RangedItem = { item: NormalizedItem; start: string; end: string };
type EventBar = { item: NormalizedItem; startCol: number; endCol: number; lane: number };

// 한 주(week) 안에서 각 일정이 몇 번째 칸부터 몇 번째 칸까지 걸치는지 계산합니다.
function getWeekEventBars(week: CalendarCell[], rangedItems: RangedItem[]): EventBar[] {
  const raw: { item: NormalizedItem; startCol: number; endCol: number }[] = [];

  for (const { item, start, end } of rangedItems) {
    let startCol = -1;
    let endCol = -1;
    week.forEach((cell, i) => {
      if (!cell) return;
      if (cell.dateStr >= start && cell.dateStr <= end) {
        if (startCol === -1) startCol = i;
        endCol = i;
      }
    });
    if (startCol !== -1) raw.push({ item, startCol, endCol });
  }

  // 시작 칸이 빠른 순 -> 기간이 긴 순으로 정렬 후, 겹치지 않는 라인(줄)에 배치합니다.
  raw.sort((a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol));

  const laneEnds: number[] = [];
  return raw.map(({ item, startCol, endCol }) => {
    let lane = laneEnds.findIndex((occupiedEnd) => occupiedEnd < startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endCol);
    } else {
      laneEnds[lane] = endCol;
    }
    return { item, startCol, endCol, lane };
  });
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const today = getTodayKST();
  const year = Number(sp.y) || today.year;
  const month = Number(sp.m) || today.month;

  const [isAdmin, items] = await Promise.all([isAdminSession(), getAllItems("schedule")]);

  // 날짜가 하나라도 있는 일정만 취급 (시작일이 종료일보다 뒤면 시작일만 사용)
  const rangedItems: RangedItem[] = items
    .filter((item) => item.startDate || item.endDate)
    .map((item) => {
      const start = item.startDate || item.endDate;
      const end = item.endDate || item.startDate;
      return { item, start, end: start > end ? start : end };
    });

  const weeks = buildMonthGrid(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-5xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader
          num="3"
          title="Schedule"
          desc="CHIRO의 주요 일정을 달력으로 확인하세요."
          action={isAdmin && <AddItemButton dbKey="schedule" />}
        />

        <div className="rounded-[2rem] border border-white bg-white/60 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex items-center justify-between">
            <Link
              href={`/schedule?y=${prevYear}&m=${prevMonth}`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <p className="text-2xl font-black text-slate-800" style={{ fontFamily: "var(--font-chakra)" }}>
              {year}. {String(month).padStart(2, "0")}
            </p>
            <Link
              href={`/schedule?y=${nextYear}&m=${nextMonth}`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mb-3 grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`text-center text-xs font-bold uppercase tracking-widest ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 sm:gap-2">
            {weeks.map((week, wi) => {
              const bars = getWeekEventBars(week, rangedItems);
              const visibleBars = bars.filter((b) => b.lane < MAX_LANES);
              const laneCount = Math.min(MAX_LANES, Math.max(0, ...bars.map((b) => b.lane + 1)));

              return (
                <div key={wi} className="relative">
                  {/* 날짜 칸 */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {week.map((cell, ci) => {
                      if (!cell) return <div key={ci} className="min-h-[3.5rem] sm:min-h-[4rem]" />;

                      const holidayName = getHolidayName(cell.dateStr);
                      const isSunday = ci === 0;
                      const isToday = cell.dateStr === today.dateStr;

                      return (
                        <div
                          key={cell.dateStr}
                          className={`min-h-[3.5rem] rounded-xl border p-1.5 sm:min-h-[4rem] sm:p-2 ${
                            isToday ? "border-[#1E3A8A] bg-blue-50/60" : "border-slate-100 bg-white/50"
                          }`}
                        >
                          <p
                            className={`text-xs font-bold ${
                              holidayName || isSunday ? "text-red-500" : "text-slate-600"
                            }`}
                          >
                            {cell.day}
                          </p>
                          {holidayName && (
                            <p className="hidden truncate text-[10px] font-bold text-red-400 sm:block">
                              {holidayName}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 일정 막대 (여러 날에 걸친 일정은 칸을 이어서 하나의 박스로 표시) */}
                  {laneCount > 0 && (
                    <div
                      className="mt-1 grid grid-cols-7 gap-x-1.5 gap-y-1 sm:gap-x-2"
                      style={{ gridAutoRows: "1.15rem" }}
                    >
                      {visibleBars.map((bar) => (
                        <Link
                          key={bar.item.id}
                          href={`/schedule/${bar.item.id}`}
                          style={{
                            gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
                            gridRow: bar.lane + 1,
                          }}
                          className="truncate rounded-md bg-[#1E3A8A]/10 px-2 py-0.5 text-[10px] font-bold text-[#1E3A8A] transition hover:bg-[#1E3A8A]/20"
                        >
                          {bar.item.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
