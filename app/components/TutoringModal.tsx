"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload } from "lucide-react";

type TutoringClass = "A" | "B";

const CLASS_LABEL: Record<TutoringClass, string> = { A: "키네마틱스A반", B: "키네마틱스B반" };
const CLASS_SCHEDULE: Record<TutoringClass, string> = {
  A: "월 18:00-20:00 · 토 14:00-16:00",
  B: "수 18:00-20:00 · 토 16:00-18:00",
};
const CAPACITY = 28;

type SubmitResult = { status: "confirmed"; rank: number } | { status: "waitlisted"; waitNumber: number };
type Mode = "apply" | "mine";

const DISMISS_KEY = "chiro-tutoring-modal-dismissed-until";

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

export function TutoringModal({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(() => getInitialOpenState(autoOpen));
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [mode, setMode] = useState<Mode>("apply");
  const [confirmedCounts, setConfirmedCounts] = useState<Record<TutoringClass, number> | null>(null);

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [className, setClassName] = useState<TutoringClass | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ updated: boolean; result: SubmitResult } | null>(null);

  const [mineName, setMineName] = useState("");
  const [mineStudentId, setMineStudentId] = useState("");
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineResult, setMineResult] = useState<{ className: TutoringClass; result: SubmitResult } | null>(
    null
  );

  function loadStats() {
    fetch("/api/tutoring", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setConfirmedCounts({
            A: data.stats?.A?.confirmedCount ?? 0,
            B: data.stats?.B?.confirmedCount ?? 0,
          });
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadStats();
  }, []);

  if (!open) return null;

  const willBeFull =
    className && confirmedCounts ? confirmedCounts[className] >= CAPACITY : false;

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
    if (!className) {
      setError("키네마틱스A반 / B반 중 하나를 선택해 주세요.");
      return;
    }
    if (!paymentFile && !willBeFull) {
      setError("입금 확인 스크린샷을 첨부해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("studentId", studentId.trim());
      form.set("className", className);
      if (paymentFile) form.set("paymentFile", paymentFile);

      const res = await fetch("/api/tutoring", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "신청 중 오류가 발생했습니다.");
      }

      setDone({ updated: Boolean(data.updated), result: data.result });
      loadStats();
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
      const res = await fetch("/api/tutoring/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mineName.trim(), studentId: mineStudentId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "조회 중 오류가 발생했습니다.");
      }
      setMineResult({ className: data.className, result: data.result });
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

  function resultText(result: SubmitResult): string {
    return result.status === "confirmed"
      ? `확정 순번 ${result.rank}번째`
      : `예비번호 ${result.waitNumber}번`;
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
              {mode === "apply" ? "튜터링 신청" : "내 신청 확인"}
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
              <p className="text-lg font-black text-[#1E3A8A]">
                {done.updated ? "신청 내용이 수정되었습니다" : "신청이 완료되었습니다"}
              </p>
              <p className="text-sm font-bold text-slate-700">{resultText(done.result)}</p>
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
                  {(["A", "B"] as TutoringClass[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setClassName(c)}
                      className={`flex flex-col items-start gap-0.5 rounded-xl border-2 px-4 py-3 text-left transition ${
                        className === c
                          ? "border-[#1E3A8A] bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-sm font-black text-slate-800">{CLASS_LABEL[c]}</span>
                      <span className="text-xs font-bold text-slate-500">{CLASS_SCHEDULE[c]}</span>
                    </button>
                  ))}
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">
                    입금 확인 스크린샷{willBeFull ? " (예비번호는 선택사항)" : ""}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    (토스뱅크 1002-4084-6167(옥소이) 15,000원 입금)
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPaymentFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-500 transition hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
                  >
                    <Upload className="h-4 w-4" />
                    {paymentFile ? paymentFile.name : "사진 선택하기"}
                  </button>
                </label>

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
            </>
          ))}

        {mode === "mine" && (
          <>
            {mineResult ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-lg font-black text-[#1E3A8A]">{CLASS_LABEL[mineResult.className]}</p>
                <p className="text-sm font-bold text-slate-700">{resultText(mineResult.result)}</p>
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
