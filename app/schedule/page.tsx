import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { getAllItems } from "@/lib/notion";
import { buildMonthGrid, getTodayKST } from "@/lib/calendar";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { AddItemButton } from "../components/AddItemButton";
import { CalendarGrid, type MiniScheduleItem } from "../components/CalendarGrid";

export const revalidate = 60;

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
  const rangedItems: MiniScheduleItem[] = items
    .filter((item) => item.startDate || item.endDate)
    .map((item) => {
      const start = item.startDate || item.endDate;
      const end = item.endDate || item.startDate;
      return { id: item.id, title: item.title, start, end: start > end ? start : end };
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

          <CalendarGrid weeks={weeks} todayStr={today.dateStr} items={rangedItems} />
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
