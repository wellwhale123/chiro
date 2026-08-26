"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload } from "lucide-react";

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function OpeningRegistrationModal() {
  const [open, setOpen] = useState(true);
  const [started, setStarted] = useState<boolean | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [opening, setOpening] = useState(false);
  const [afterParty1, setAfterParty1] = useState(false);
  const [afterParty2, setAfterParty2] = useState(false);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ updated: boolean; logTime: string } | null>(null);

  const [afterParty1Count, setAfterParty1Count] = useState<number | null>(null);
  const [afterParty1Capacity, setAfterParty1Capacity] = useState<number | null>(null);
  const [full, setFull] = useState(false);

  function loadInfo() {
    fetch("/api/opening", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setStarted(Boolean(data.started));
          setStartTime(typeof data.startTime === "string" ? data.startTime : null);
          if (typeof data.afterParty1Count === "number") setAfterParty1Count(data.afterParty1Count);
          if (typeof data.afterParty1Capacity === "number") setAfterParty1Capacity(data.afterParty1Capacity);
          setFull(Boolean(data.full));
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadInfo();
  }, []);

  // 접수 시작 전이면 1초마다 남은 시간을 계산하고, 시각이 되면 현황을 다시 불러와 자동으로 접수를 엽니다.
  useEffect(() => {
    if (started !== false || !startTime) return;
    const targetMs = new Date(startTime).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.round((targetMs - Date.now()) / 1000));
      setCountdown(diff);
      if (diff <= 0) {
        loadInfo();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [started, startTime]);

  if (!open) return null;

  const startTimeLabel = startTime
    ? new Date(startTime).toLocaleTimeString("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !studentId.trim()) {
      setError("이름과 학번을 모두 입력해 주세요.");
      return;
    }
    if (!opening && !afterParty1 && !afterParty2) {
      setError("개강총회 / 뒷풀이1차 / 뒷풀이2차 중 최소 하나는 선택해 주세요.");
      return;
    }
    if (!paymentFile) {
      setError("입금 확인 스크린샷을 첨부해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("studentId", studentId.trim());
      form.set("opening", String(opening));
      form.set("afterParty1", String(afterParty1));
      form.set("afterParty2", String(afterParty2));
      if (paymentFile) form.set("paymentFile", paymentFile);

      const res = await fetch("/api/opening", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "신청 중 오류가 발생했습니다.");
      }

      setDone({ updated: Boolean(data.updated), logTime: data.logTime || new Date().toISOString() });
      loadInfo(); // 방금 신청으로 뒷풀이 1차 인원수가 바뀌었을 수 있으니 다시 불러옵니다.
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

        {started === null ? (
          <p className="py-10 text-center text-sm font-medium text-slate-500">
            신청 현황을 불러오는 중...
          </p>
        ) : !started ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-bold text-slate-400">접수 시작까지</p>
            <p className="font-black tabular-nums text-[#1E3A8A] text-4xl">{formatCountdown(countdown)}</p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {startTimeLabel && `${startTimeLabel}부터 `}신청을 받습니다. 잠시만 기다려 주세요.
            </p>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-lg font-black text-[#1E3A8A]">
              {done.updated ? "신청 내용이 수정되었습니다" : "신청이 완료되었습니다"}
            </p>
            <div className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              <p>이름: {name}</p>
              <p>학번: {studentId}</p>
              <p>
                신청 시각:{" "}
                {new Date(done.logTime).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </p>
            </div>
            <p className="text-sm font-black text-blue-700">
              오류 예방으로 인해 현재 화면을 캡쳐해주세요.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
            >
              확인
            </button>
          </div>
        ) : full ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-lg font-black text-slate-800">
              개강총회 신청이 마감되었습니다.
              <br />
              문의사항이 있을 시 운영진에게 연락 부탁드립니다.
            </p>
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
              이름, 학번과 참석하실 항목을 선택해 주세요.
              <br />
              (이미 신청하셨다면 다시 제출 시 내용이 수정됩니다.)
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
                <span className="text-xs font-bold text-slate-500">참석 항목 (복수 선택 가능)</span>
                <div className="flex flex-col gap-2">
                  {[
                    { label: "개강총회", checked: opening, set: setOpening, suffix: "" },
                    {
                      label: "뒷풀이 1차",
                      checked: afterParty1,
                      set: setAfterParty1,
                      suffix:
                        afterParty1Count !== null && afterParty1Capacity !== null
                          ? ` (여석 : ${Math.max(0, afterParty1Capacity - afterParty1Count)})`
                          : "",
                    },
                    { label: "뒷풀이 2차", checked: afterParty2, set: setAfterParty2, suffix: "" },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-[#1E3A8A]"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.set(e.target.checked)}
                        className="h-4 w-4 accent-[#1E3A8A]"
                      />
                      {item.label}
                      {item.suffix && <span className="text-slate-400">{item.suffix}</span>}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-500">입금 확인 스크린샷</span>
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

            <p className="mt-4 text-center text-xs font-bold text-red-600">
              취소는 운영진에게 문의해주세요.
            </p>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
