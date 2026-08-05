"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type CapacityInfo = {
  capacity: number;
  confirmedCount: number;
  waitlistCount: number;
  total: number;
};

type SubmitResult = {
  status: "confirmed" | "waitlist";
  waitlistNumber?: number;
  alreadyRegistered?: boolean;
};

export function OpeningRegistrationModal() {
  const [open, setOpen] = useState(true);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [info, setInfo] = useState<CapacityInfo | null>(null);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    fetch("/api/opening")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setInfo({
            capacity: data.capacity,
            confirmedCount: data.confirmedCount,
            waitlistCount: data.waitlistCount,
            total: data.total,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, []);

  if (!open) return null;

  const remaining = info ? Math.max(0, info.capacity - info.confirmedCount) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !studentId.trim()) {
      setError("이름과 학번을 모두 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentId: studentId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "신청 중 오류가 발생했습니다.");
      }

      setResult({
        status: data.status,
        waitlistNumber: data.waitlistNumber,
        alreadyRegistered: data.alreadyRegistered,
      });

      setInfo((prev) => {
        if (!prev || data.alreadyRegistered) return prev;
        const total = prev.total + 1;
        return {
          ...prev,
          total,
          confirmedCount: Math.min(total, prev.capacity),
          waitlistCount: Math.max(0, total - prev.capacity),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm sm:px-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white bg-white p-6 shadow-2xl sm:max-w-md sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">CHIRO</p>
            <h2 className="text-xl font-black text-slate-800">개강총회 신청</h2>
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

        {result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            {result.status === "confirmed" ? (
              <>
                <p className="text-lg font-black text-[#1E3A8A]">신청이 완료되었습니다</p>
                {result.alreadyRegistered && (
                  <p className="text-xs font-medium text-slate-400">이미 신청 완료된 학번이에요.</p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-black text-slate-800">
                  예비번호 {String(result.waitlistNumber ?? 0).padStart(2, "0")}번
                </p>
                <p className="text-sm font-medium text-slate-500">
                  정원이 마감되어 예비 명단에 등록되었습니다.
                </p>
              </>
            )}
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
            <p className="mb-5 text-sm font-medium text-slate-500">
              {loadingInfo
                ? "신청 현황을 불러오는 중..."
                : remaining !== null && remaining > 0
                  ? `정원 ${info?.capacity}명 중 ${remaining}자리 남았습니다.`
                  : `정원이 모두 찼습니다. 현재 예비번호 ${info?.waitlistCount ?? 0}번까지 있어요.`}
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
                  placeholder="20231234"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                />
              </label>

              {error && <p className="text-sm font-medium text-red-600">{error}</p>}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                >
                  나중에
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
                >
                  {submitting ? "신청 중..." : "신청하기"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
