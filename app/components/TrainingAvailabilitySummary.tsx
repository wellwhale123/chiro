"use client";

import { useEffect, useState } from "react";

type TrainingType = "printer" | "solder";

const SLOTS: Record<TrainingType, { date: string; dateLabel: string; time: string }[]> = {
  printer: [
    { date: "2026-09-08", dateLabel: "9/8(화)", time: "11:00-12:00" },
    { date: "2026-09-08", dateLabel: "9/8(화)", time: "17:00-18:00" },
    { date: "2026-09-09", dateLabel: "9/9(수)", time: "11:00-12:00" },
    { date: "2026-09-09", dateLabel: "9/9(수)", time: "17:00-18:00" },
    { date: "2026-09-10", dateLabel: "9/10(목)", time: "11:00-12:00" },
    { date: "2026-09-10", dateLabel: "9/10(목)", time: "17:00-18:00" },
  ],
  solder: [
    { date: "2026-09-08", dateLabel: "9/8(화)", time: "12:00-13:00" },
    { date: "2026-09-08", dateLabel: "9/8(화)", time: "18:00-19:00" },
    { date: "2026-09-09", dateLabel: "9/9(수)", time: "12:00-13:00" },
    { date: "2026-09-09", dateLabel: "9/9(수)", time: "18:00-19:00" },
    { date: "2026-09-10", dateLabel: "9/10(목)", time: "12:00-13:00" },
    { date: "2026-09-10", dateLabel: "9/10(목)", time: "18:00-19:00" },
  ],
};

const TYPE_LABEL: Record<TrainingType, string> = { printer: "프린터기", solder: "인두기" };
const CAPACITY = 15;

export function TrainingAvailabilitySummary() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch("/api/training", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setCounts(data.counts || {});
      })
      .catch(() => {});
  }, []);

  return (
    <div className="-mt-2 rounded-2xl border border-slate-100 bg-white/60 p-4">
      <p className="mb-3 text-xs font-black tracking-wide text-slate-400">실시간 여석 현황</p>
      <div className="grid grid-cols-2 gap-4">
        {(["printer", "solder"] as TrainingType[]).map((type) => (
          <div key={type} className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[#1E3A8A]">{TYPE_LABEL[type]}</span>
            {SLOTS[type].map((s) => {
              const key = `${s.date}_${s.time}`;
              const used = counts?.[key] ?? 0;
              const remaining = counts ? Math.max(0, CAPACITY - used) : null;
              const full = remaining === 0;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between text-xs font-medium text-slate-500"
                >
                  <span>
                    {s.dateLabel} {s.time}
                  </span>
                  <span className={full ? "font-bold text-red-500" : "font-bold text-slate-600"}>
                    {remaining === null ? "-" : full ? "마감" : `여석 ${remaining}`}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
