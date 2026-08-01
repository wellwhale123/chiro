"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { getHolidayName } from "@/lib/holidays";
import type { CalendarCell } from "@/lib/calendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_LANES = 4;
const LANE_HEIGHT_REM = 1.15;
const LANE_GAP_REM = 0.3;
const HEADER_HEIGHT_REM = 2.35;

export type MiniScheduleItem = { id: string; title: string; start: string; end: string };

type EventBar = { item: MiniScheduleItem; startCol: number; endCol: number; lane: number };

// 한 주(week) 안에서 각 일정이 몇 번째 칸부터 몇 번째 칸까지 걸치는지 계산합니다.
function getWeekEventBars(week: CalendarCell[], items: MiniScheduleItem[]): EventBar[] {
  const raw: { item: MiniScheduleItem; startCol: number; endCol: number }[] = [];

  for (const item of items) {
    let startCol = -1;
    let endCol = -1;
    week.forEach((cell, i) => {
      if (!cell) return;
      if (cell.dateStr >= item.start && cell.dateStr <= item.end) {
        if (startCol === -1) startCol = i;
        endCol = i;
      }
    });
    if (startCol !== -1) raw.push({ item, startCol, endCol });
  }

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

export function CalendarGrid({
  weeks,
  todayStr,
  items,
}: {
  weeks: CalendarCell[][];
  todayStr: string;
  items: MiniScheduleItem[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function itemsForDate(dateStr: string): MiniScheduleItem[] {
    return items.filter((item) => dateStr >= item.start && dateStr <= item.end);
  }

  return (
    <>
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
          const bars = getWeekEventBars(week, items);
          const visibleBars = bars.filter((b) => b.lane < MAX_LANES);
          const laneCount = Math.min(MAX_LANES, Math.max(0, ...bars.map((b) => b.lane + 1)));
          const cellMinHeight = `${HEADER_HEIGHT_REM + laneCount * LANE_HEIGHT_REM + (laneCount > 0 ? (laneCount - 1) * LANE_GAP_REM : 0) + 0.4}rem`;

          return (
            <div key={wi} className="relative">
              {/* 날짜 칸 (흰 배경) */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {week.map((cell, ci) => {
                  if (!cell) return <div key={ci} style={{ minHeight: cellMinHeight }} />;

                  const holidayName = getHolidayName(cell.dateStr);
                  const isSunday = ci === 0;
                  const isToday = cell.dateStr === todayStr;
                  const hasItems = itemsForDate(cell.dateStr).length > 0;

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => hasItems && setSelectedDate(cell.dateStr)}
                      style={{ minHeight: cellMinHeight }}
                      className={`rounded-xl border p-1.5 text-left sm:p-2 ${
                        isToday ? "border-[#1E3A8A] bg-blue-50/60" : "border-slate-100 bg-white/50"
                      } ${hasItems ? "cursor-pointer transition hover:bg-white/90" : "cursor-default"}`}
                    >
                      <p
                        className={`mb-1 text-xs font-bold ${
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
                    </button>
                  );
                })}
              </div>

              {/* 일정 막대: 흰 날짜 칸 위에 겹쳐서 표시 */}
              {laneCount > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-7 gap-x-1.5 sm:gap-x-2"
                  style={{
                    paddingTop: `${HEADER_HEIGHT_REM}rem`,
                    gridAutoRows: `${LANE_HEIGHT_REM}rem`,
                    rowGap: `${LANE_GAP_REM}rem`,
                  }}
                >
                  {visibleBars.map((bar) => {
                    const isActive = hoveredId === bar.item.id;
                    return (
                      <Link
                        key={bar.item.id}
                        href={`/schedule/${bar.item.id}`}
                        onMouseEnter={() => setHoveredId(bar.item.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{
                          gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
                          gridRow: bar.lane + 1,
                        }}
                        className={`pointer-events-auto flex items-center truncate rounded-md px-2 text-[10px] font-bold shadow-sm backdrop-blur-sm transition-colors ${
                          isActive ? "bg-[#1E3A8A] text-white" : "bg-slate-500/15 text-slate-600"
                        }`}
                      >
                        {bar.item.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDate &&
        typeof document !== "undefined" &&
        createPortal(
          <DayPopup
            dateStr={selectedDate}
            items={itemsForDate(selectedDate)}
            onClose={() => setSelectedDate(null)}
          />,
          document.body
        )}
    </>
  );
}

function DayPopup({
  dateStr,
  items,
  onClose,
}: {
  dateStr: string;
  items: MiniScheduleItem[];
  onClose: () => void;
}) {
  const [, m, d] = dateStr.split("-").map(Number);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <p className="text-lg font-black text-slate-800">
            {m}월 {d}일 일정
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/schedule/${item.id}`}
              className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-[#1E3A8A]/30 hover:bg-blue-50 hover:text-[#1E3A8A]"
            >
              {item.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
