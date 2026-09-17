"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const DISMISS_KEY = "chiro-mt-modal-dismissed-until";

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

export function MtModal({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(() => getInitialOpenState(autoOpen));
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

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

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/mt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentId: studentId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "신청 중 오류가 발생했습니다.");
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
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
            <h2 className="text-xl font-black text-slate-800">MT 신청</h2>
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
            {autoOpen && !done && (
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

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-lg font-black text-[#1E3A8A]">MT 신청이 완료되었어요.</p>
            <button
              type="button"
              onClick={closeModal}
              className="mt-3 rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
            >
              확인
            </button>
          </div>
        ) : (
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

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? "신청 중..." : "신청하기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
