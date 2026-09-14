"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type StudyProgram = "arduino" | "cad";

type ProgramResult =
  | { status: "not-applicable" }
  | { status: "confirmed"; rank: number }
  | { status: "waitlisted"; waitNumber: number };

const PROGRAM_LABEL: Record<StudyProgram, string> = { arduino: "아두이노", cad: "CAD" };
const CAPACITY_BY_PROGRAM: Record<StudyProgram, number> = { arduino: 20, cad: 30 };
const DISMISS_KEY = "chiro-study-modal-dismissed-until";

function getInitialOpenState(autoOpen: boolean): boolean {
  if (!autoOpen) return true;
  if (typeof window === "undefined") return true;
  try {
    const until = window.localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < Number(until)) return false;
  } catch {
    // 프라이빗 모드 등으로 localStorage를 못 쓰면 그냥 보여줍니다.
  }
  return true;
}

function resultText(result: ProgramResult): string | null {
  if (result.status === "confirmed") return `확정 순번 ${result.rank}번째`;
  if (result.status === "waitlisted") return `예비번호 ${result.waitNumber}번`;
  return null;
}

type Mode = "apply" | "mine";

export function StudyModal({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(() => getInitialOpenState(autoOpen));
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [mode, setMode] = useState<Mode>("apply");
  const [counts, setCounts] = useState<Record<StudyProgram, number> | null>(null);

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [arduino, setArduino] = useState(false);
  const [cad, setCad] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ arduino: ProgramResult; cad: ProgramResult } | null>(null);

  const [mineName, setMineName] = useState("");
  const [mineStudentId, setMineStudentId] = useState("");
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineResult, setMineResult] = useState<{ arduino: ProgramResult; cad: ProgramResult } | null>(null);

  function loadCounts() {
    fetch("/api/study", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setCounts({
            arduino: data.stats?.arduino?.confirmedCount ?? 0,
            cad: data.stats?.cad?.confirmedCount ?? 0,
          });
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadCounts();
  }, []);

  if (!open) return null;

  function remainingOf(p: StudyProgram): number | null {
    if (!counts) return null;
    return Math.max(0, CAPACITY_BY_PROGRAM[p] - counts[p]);
  }

  function closeModal() {
    if (dontShowAgain && autoOpen) {
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
      } catch {
        // 저장 실패해도 닫기는 정상 진행
      }
    }
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !studentId.trim()) {
      setError("이름과 학번을 모두 입력해 주세요.");
      return;
    }
    if (!arduino && !cad) {
      setError("아두이노 / CAD 중 최소 하나는 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentId: studentId.trim(), arduino, cad }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "신청 중 오류가 발생했습니다.");
      }

      setDone({ arduino: data.arduino, cad: data.cad });
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
      const res = await fetch("/api/study/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mineName.trim(), studentId: mineStudentId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "조회 중 오류가 발생했습니다.");
      }
      setMineResult({ arduino: data.arduino, cad: data.cad });
    } catch (err) {
      setMineError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setMineLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMineError(null);
  }

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm sm:px-6"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white bg-white p-6 shadow-2xl sm:max-w-md sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">CHIRO</p>
            <h2 className="text-xl font-black text-slate-800">
              {mode === "apply" ? "아두이노·CAD 스터디 신청" : "내 신청 확인"}
            </h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={closeModal}
              aria-label="닫기"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            {autoOpen && (
              <label className="flex cursor-pointer items-center gap-1 text-[10px] font-bold whitespace-nowrap text-slate-400">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="h-3 w-3 accent-[#1E3A8A]"
                />
                24시간 보지 않기
              </label>
            )}
          </div>
        </div>

        {mode === "apply" &&
          (done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-lg font-black text-[#1E3A8A]">신청이 완료되었습니다</p>
              <div className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                {resultText(done.arduino) && <p>아두이노: {resultText(done.arduino)}</p>}
                {resultText(done.cad) && <p>CAD: {resultText(done.cad)}</p>}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="mt-3 rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
              >
                확인
              </button>
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm font-medium text-slate-500">
                신청하실 스터디를 선택해 주세요. 아두이노와 CAD 둘 다 신청하실 수 있어요.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

                <div className="flex flex-col gap-2">
                  {([
                    { p: "arduino" as StudyProgram, checked: arduino, set: setArduino },
                    { p: "cad" as StudyProgram, checked: cad, set: setCad },
                  ]).map((item) => {
                    const remaining = remainingOf(item.p);
                    return (
                      <label
                        key={item.p}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-[#1E3A8A]"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.set(e.target.checked)}
                          className="h-4 w-4 accent-[#1E3A8A]"
                        />
                        {PROGRAM_LABEL[item.p]}
                        <span className="text-slate-400">
                          {remaining === null
                            ? ""
                            : remaining > 0
                              ? `(여석 : ${remaining})`
                              : "(예비 등록)"}
                        </span>
                      </label>
                    );
                  })}
                </div>

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
                내 신청 확인
              </button>

              <p className="mt-4 text-center text-xs font-bold text-red-600">
                취소는 기술부장 최원재에게 문의부탁드립니다.
              </p>
            </>
          ))}

        {mode === "mine" && (
          <>
            {mineResult ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                  {resultText(mineResult.arduino) ? (
                    <p>아두이노: {resultText(mineResult.arduino)}</p>
                  ) : (
                    <p>아두이노: 신청 내역 없음</p>
                  )}
                  {resultText(mineResult.cad) ? (
                    <p>CAD: {resultText(mineResult.cad)}</p>
                  ) : (
                    <p>CAD: 신청 내역 없음</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => switchMode("apply")}
                  className="mt-3 rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
                >
                  확인
                </button>
              </div>
            ) : (
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

                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => switchMode("apply")}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                  >
                    돌아가기
                  </button>
                  <button
                    type="submit"
                    disabled={mineLoading}
                    className="flex-1 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
                  >
                    {mineLoading ? "조회 중..." : "조회하기"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
