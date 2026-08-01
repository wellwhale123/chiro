import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { getSortedItems } from "@/lib/notion";
import { getHolidayName } from "@/lib/holidays";
import { buildMonthGrid, getTodayKST } from "@/lib/calendar";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { AddItemButton } from "../components/AddItemButton";

export const revalidate = 60;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const today = getTodayKST();
  const year = Number(sp.y) || today.year;
  const month = Number(sp.m) || today.month;

  const [isAdmin, items] = await Promise.all([isAdminSession(), getSortedItems("schedule")]);

  const itemsByDate = new Map<string, typeof items>();
  for (const item of items) {
    if (!item.date) continue;
    const list = itemsByDate.get(item.date) ?? [];
    list.push(item);
    itemsByDate.set(item.date, list);
  }

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

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weeks.flatMap((week, wi) =>
              week.map((cell, ci) => {
                if (!cell) return <div key={`${wi}-${ci}`} />;

                const holidayName = getHolidayName(cell.dateStr);
                const isSunday = ci === 0;
                const dayItems = itemsByDate.get(cell.dateStr) ?? [];
                const isToday = cell.dateStr === today.dateStr;

                return (
                  <div
                    key={cell.dateStr}
                    className={`min-h-[5.5rem] rounded-xl border p-1.5 sm:min-h-[7rem] sm:p-2 ${
                      isToday ? "border-[#1E3A8A] bg-blue-50/60" : "border-slate-100 bg-white/50"
                    }`}
                  >
                    <p
                      className={`mb-1 text-xs font-bold ${
                        holidayName || isSunday ? "text-red-500" : "text-slate-600"
                      }`}
                    >
                      {cell.day}
                    </p>
                    {holidayName && (
                      <p className="mb-1 hidden truncate text-[10px] font-bold text-red-400 sm:block">
                        {holidayName}
                      </p>
                    )}
                    <div className="flex flex-col gap-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <Link
                          key={item.id}
                          href={`/schedule/${item.id}`}
                          className="truncate rounded-md bg-[#1E3A8A]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#1E3A8A] transition hover:bg-[#1E3A8A]/20"
                        >
                          {item.title}
                        </Link>
                      ))}
                      {dayItems.length > 3 && (
                        <p className="text-[10px] font-bold text-slate-400">+{dayItems.length - 3}개 더보기</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
