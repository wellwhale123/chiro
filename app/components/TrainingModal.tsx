"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type TrainingType = "printer" | "solder";

type SlotOption = { date: string; dateLabel: string; time: string };

const SLOTS: Record<TrainingType, SlotOption[]> = {
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

const TYPE_LABEL: Record<TrainingType, string> = { printer: "프린터기 교육", solder: "인두기 교육" };
const CAPACITY = 15;

function slotKey(date: string, time: string) {
  return `${date}_${time}`;
}

const DATES = [
  { date: "2026-09-08", label: "9/8", weekday: "화" },
  { date: "2026-09-09", label: "9/9", weekday: "수" },
  { date: "2026-09-10", label: "9/10", weekday: "목" },
];

const TIME_ROWS: { time: string; type: TrainingType }[] = [
  { time: "11:00-12:00", type: "printer" },
  { time: "12:00-13:00", type: "solder" },
  { time: "17:00-18:00", type: "printer" },
  { time: "18:00-19:00", type: "solder" },
];

type Mode = "apply" | "mine";

export function TrainingModal() {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("apply");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [printerChoice, setPrinterChoice] = useState<string>(""); // slotKey or ""
  const [solderChoice, setSolderChoice] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ printer: string; solder: string } | null>(null);

  const [mineName, setMineName] = useState("");
  const [mineStudentId, setMineStudentId] = useState("");
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineSessions, setMineSessions] = useState<
    { type: TrainingType; date: string; time: string }[] | null
  >(null);
  const [cancellingType, setCancellingType] = useState<TrainingType | null>(null);

  function loadCounts() {
    fetch("/api/training", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setCounts(data.counts || {});
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadCounts();
  }, []);

  if (!open) return null;

  function remainingOf(date: string, time: string) {
    const used = counts[slotKey(date, time)] ?? 0;
    return Math.max(0, CAPACITY - used);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !studentId.trim()) {
      setError("이름과 학번을 모두 입력해 주세요.");
      return;
    }
    if (!printerChoice && !solderChoice) {
      setError("프린터기 / 인두기 교육 중 최소 하나는 선택해 주세요.");
      return;
    }

    const printerSlot = printerChoice
      ? SLOTS.printer.find((s) => slotKey(s.date, s.time) === printerChoice)
      : null;
    const solderSlot = solderChoice
      ? SLOTS.solder.find((s) => slotKey(s.date, s.time) === solderChoice)
      : null;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          studentId: studentId.trim(),
          printer: printerSlot ? { date: printerSlot.date, time: printerSlot.time } : null,
          solder: solderSlot ? { date: solderSlot.date, time: solderSlot.time } : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "신청 중 오류가 발생했습니다.");
      }

      setDone({
        printer: printerSlot ? `${printerSlot.dateLabel} ${printerSlot.time}` : "신청 안 함",
        solder: solderSlot ? `${solderSlot.dateLabel} ${solderSlot.time}` : "신청 안 함",
      });
      loadCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!mineName.trim() || !mineStudentId.trim()) {
      setMineError("이름과 학번을 모두 입력해 주세요.");
      return;
    }
    setMineLoading(true);
    setMineError(null);
    try {
      const res = await fetch("/api/training/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mineName.trim(), studentId: mineStudentId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "조회 중 오류가 발생했습니다.");
      }
      setMineSessions(data.sessions || []);
    } catch (err) {
      setMineError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setMineLoading(false);
    }
  }

  async function handleCancel(type: TrainingType) {
    setCancellingType(type);
    setMineError(null);
    try {
      const res = await fetch("/api/training/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mineName.trim(), studentId: mineStudentId.trim(), type }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "취소 중 오류가 발생했습니다.");
      }
      setMineSessions((prev) => (prev ? prev.filter((s) => s.type !== type) : prev));
      loadCounts();
    } catch (err) {
      setMineError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setCancellingType(null);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMineError(null);
  }

  function renderTimetable() {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#1E3A8A]" /> 프린터기
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> 인두기
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border-2 border-[#1E3A8A]/30 shadow-sm">
          <div className="grid grid-cols-[64px_repeat(3,1fr)] bg-[#1E3A8A] text-center text-xs font-black text-white">
            <div className="py-2" />
            {DATES.map((d) => (
              <div key={d.date} className="border-l border-white/20 py-2">
                {d.label}
                <span className="ml-1 font-medium text-white/70">({d.weekday})</span>
              </div>
            ))}
          </div>
          {TIME_ROWS.map((row, i) => (
            <div key={row.time}>
              {i === 2 && <div className="h-3 bg-slate-50" />}
              <div className="grid grid-cols-[64px_repeat(3,1fr)] border-t border-slate-300">
                <div className="flex items-center justify-center bg-slate-100 px-1 text-center text-[10px] font-bold text-slate-600">
                  {row.time}
                </div>
                {DATES.map((d) => {
                  const key = slotKey(d.date, row.time);
                  const remaining = remainingOf(d.date, row.time);
                  const full = remaining <= 0;
                  const selected =
                    row.type === "printer" ? printerChoice === key : solderChoice === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={full && !selected}
                      onClick={() => {
                        const setChoice = row.type === "printer" ? setPrinterChoice : setSolderChoice;
                        setChoice((prev) => (prev === key ? "" : key));
                      }}
                      className={`flex flex-col items-center justify-center gap-0.5 border-l border-slate-300 py-2.5 text-[11px] font-bold transition ${
                        selected
                          ? row.type === "printer"
                            ? "bg-[#1E3A8A] text-white"
                            : "bg-emerald-600 text-white"
                          : full
                            ? "cursor-not-allowed bg-slate-50 text-slate-300"
                          : "text-slate-600 hover:bg-blue-50"
                    }`}
                  >
                    <span>{TYPE_LABEL[row.type]}</span>
                    <span className={selected ? "text-white/80" : "text-slate-400"}>
                      {full ? "마감" : `여석 ${remaining}`}
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-slate-400">
          선택된 칸을 다시 누르면 취소돼요. 프린터기·인두기 각각 최대 1칸씩 고를 수 있어요.
        </p>
      </div>
    );
  }

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm sm:px-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">CHIRO</p>
            <h2 className="text-xl font-black text-slate-800">
              {mode === "apply" ? "프린터기·인두기 교육 신청" : "내 신청 확인·취소"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "apply" &&
          (done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-lg font-black text-[#1E3A8A]">신청이 완료되었습니다</p>
              <div className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                <p>프린터기: {done.printer}</p>
                <p>인두기: {done.solder}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
              >
                확인
              </button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm font-medium text-slate-500">
                다음주 화(9/8)·수(9/9)·목(9/10) 진행되는 교육입니다. 프린터기·인두기 중 하나 또는 둘 다(서로 다른
                시간) 선택할 수 있어요.
              </p>
              <p className="mb-5 text-sm font-bold text-red-600">
                치로 부원으로서 한 번이라도 교육을 수강했다면 다시 수강하실 필요 없습니다. 다만 이번에
                수강하지 않으시면 이번 학기 동안 동방의 프린터기와 인두기를 사용하실 수 없습니다.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">이름</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                    autoFocus
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">학번</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="20261234"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                  />
                </label>

                {renderTimetable()}

                {error && <p className="text-sm font-medium text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
                >
                  {submitting ? "신청 중..." : "신청하기"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => switchMode("mine")}
                className="mt-4 w-full text-center text-sm font-bold text-blue-600 underline decoration-2 underline-offset-2 transition hover:text-blue-700"
              >
                내 신청 확인 / 취소
              </button>
            </>
          ))}

        {mode === "mine" && (
          <>
            <p className="mb-5 text-sm font-medium text-slate-500">
              이름과 학번을 입력하시면 현재 신청 내역을 보여드려요. 시간을 바꾸고 싶으시면 신청 화면에서 새
              시간을 다시 선택해서 제출하시면 자동으로 변경됩니다.
            </p>

            <form onSubmit={handleLookup} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-500">이름</span>
                <input
                  type="text"
                  value={mineName}
                  onChange={(e) => setMineName(e.target.value)}
                  placeholder="홍길동"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-500">학번</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={mineStudentId}
                  onChange={(e) => setMineStudentId(e.target.value)}
                  placeholder="20261234"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                />
              </label>

              {mineError && <p className="text-sm font-medium text-red-600">{mineError}</p>}

              <button
                type="submit"
                disabled={mineLoading}
                className="rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
              >
                {mineLoading ? "조회 중..." : "조회하기"}
              </button>
            </form>

            {mineSessions && (
              <div className="mt-5 flex flex-col gap-2">
                {mineSessions.length === 0 ? (
                  <p className="text-center text-sm font-medium text-slate-400">
                    현재 신청한 교육이 없어요.
                  </p>
                ) : (
                  mineSessions.map((s) => (
                    <div
                      key={s.type}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div className="text-sm font-bold text-slate-700">
                        {TYPE_LABEL[s.type]} · {s.date.slice(5).replace("-", "/")} {s.time}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCancel(s.type)}
                        disabled={cancellingType === s.type}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        {cancellingType === s.type ? "취소 중..." : "취소"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => switchMode("apply")}
              className="mt-4 w-full text-center text-sm font-bold text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline"
            >
              신청 화면으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
