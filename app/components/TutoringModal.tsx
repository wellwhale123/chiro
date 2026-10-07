"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

// 입금 안내 (확정 인원에게만 표시)
const PAYMENT_GUIDE = "(토스뱅크 1002-4084-6167(옥소이) 15,000원 입금)";
const CANCEL_GUIDE = "취소를 희망할시 총무부장 옥소이에게 개인 연락부탁드립니다.";

type ClassStats = { name: string; confirmedCount: number; waitingCount: number };
type SubmitResult = { status: "confirmed"; rank: number } | { status: "waitlisted"; waitNumber: number };
type Mode = "apply" | "mine";
type MineResult = { className: string; result: SubmitResult; needsPayment: boolean };

const DISMISS_KEY = "chiro-tutoring-modal-dismissed-until";
const INPUT_CLASS =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]";

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

function resultText(result: SubmitResult): string {
  return result.status === "confirmed" ? `확정 ${result.rank}번째` : `예비번호 ${result.waitNumber}번`;
}

function PaymentPicker({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-slate-500">입금 확인 스크린샷</span>
      <span className="text-xs font-bold text-slate-500">{PAYMENT_GUIDE}</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-500 transition hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
      >
        <Upload className="h-4 w-4" />
        {file ? file.name : "사진 선택하기"}
      </button>
      <span className="text-xs font-bold text-red-600">{CANCEL_GUIDE}</span>
    </label>
  );
}

export function TutoringModal({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(() => getInitialOpenState(autoOpen));
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [mode, setMode] = useState<Mode>("apply");

  const [classes, setClasses] = useState<ClassStats[] | null>(null);
  const [capacity, setCapacity] = useState(30);
  const [hasTeammates, setHasTeammates] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [className, setClassName] = useState<string | null>(null);
  const [teammates, setTeammates] = useState(["", "", ""]);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ updated: boolean; result: SubmitResult } | null>(null);

  const [mineName, setMineName] = useState("");
  const [mineStudentId, setMineStudentId] = useState("");
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineResult, setMineResult] = useState<MineResult | null>(null);
  const [minePaymentFile, setMinePaymentFile] = useState<File | null>(null);
  const [minePaying, setMinePaying] = useState(false);

  function loadStats() {
    fetch("/api/tutoring", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setClasses(data.classes ?? []);
          setCapacity(data.capacity ?? 30);
          setHasTeammates(Boolean(data.hasTeammates));
          setLoadError(null);
        } else {
          setLoadError(data?.error || "분반 정보를 불러오지 못했습니다.");
        }
      })
      .catch(() => setLoadError("분반 정보를 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadStats();
  }, []);

  if (!open) return null;

  const selected = classes?.find((c) => c.name === className) ?? null;
  const selectedFull = selected ? selected.confirmedCount >= capacity : false;

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

  async function postApplication(fields: {
    name: string;
    studentId: string;
    className: string;
    teammates?: string[];
    paymentFile?: File | null;
  }) {
    const form = new FormData();
    form.set("name", fields.name);
    form.set("studentId", fields.studentId);
    form.set("className", fields.className);
    (fields.teammates ?? []).forEach((t, i) => {
      if (t.trim()) form.set(`teammate${i + 1}`, t.trim());
    });
    if (fields.paymentFile) {
      // 스마트폰 원본 사진이 Vercel 요청 용량 제한에 걸리지 않도록 줄여서 보냅니다.
      const compressed = await compressImage(fields.paymentFile).catch(() => fields.paymentFile as File);
      form.set("paymentFile", compressed);
    }

    const res = await fetch("/api/tutoring", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || "신청 중 오류가 발생했습니다.");
    }
    return data as { updated: boolean; result: SubmitResult };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !studentId.trim()) {
      setError("이름과 학번을 모두 입력해 주세요.");
      return;
    }
    if (!className) {
      setError("분반을 선택해 주세요.");
      return;
    }
    if (!selectedFull && !paymentFile) {
      setError("입금 확인 스크린샷을 첨부해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await postApplication({
        name: name.trim(),
        studentId: studentId.trim(),
        className,
        teammates: hasTeammates ? teammates : [],
        // 예비 신청은 입금을 받지 않으므로 파일을 보내지 않습니다.
        paymentFile: selectedFull ? null : paymentFile,
      });
      setDone({ updated: Boolean(data.updated), result: data.result });
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      loadStats();
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
      setMineResult({
        className: data.className,
        result: data.result,
        needsPayment: Boolean(data.needsPayment),
      });
    } catch (err) {
      setMineError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setMineLoading(false);
    }
  }

  // 예비 → 확정으로 올라온 사람이 입금 스크린샷을 제출합니다.
  async function handleMinePayment() {
    if (!mineResult || !minePaymentFile) {
      setMineError("입금 확인 스크린샷을 첨부해 주세요.");
      return;
    }
    setMinePaying(true);
    setMineError(null);
    try {
      const data = await postApplication({
        name: mineName.trim(),
        studentId: mineStudentId.trim(),
        className: mineResult.className,
        paymentFile: minePaymentFile,
      });
      setMineResult({ className: mineResult.className, result: data.result, needsPayment: false });
    } catch (err) {
      setMineError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setMinePaying(false);
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
              <p
                className={`text-lg font-black ${
                  done.result.status === "confirmed" ? "text-[#1E3A8A]" : "text-red-600"
                }`}
              >
                {done.result.status === "waitlisted"
                  ? "예비 신청이 완료되었습니다"
                  : done.updated
                    ? "신청 내용이 수정되었습니다"
                    : "신청이 완료되었습니다"}
              </p>
              <p className="text-sm font-bold text-slate-700">
                {className} · {resultText(done.result)}
              </p>
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
                    className={INPUT_CLASS}
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
                    className={INPUT_CLASS}
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-500">분반</span>
                  {!classes && !loadError && (
                    <p className="text-center text-sm font-bold text-slate-400">불러오는 중...</p>
                  )}
                  {loadError && <p className="text-sm font-medium text-red-600">{loadError}</p>}
                  {classes?.map((c) => {
                    const full = c.confirmedCount >= capacity;
                    const active = className === c.name;
                    const tone = full
                      ? active
                        ? "border-red-600 bg-red-100"
                        : "border-red-300 bg-red-50 hover:border-red-400"
                      : active
                        ? "border-[#1E3A8A] bg-blue-50"
                        : "border-slate-200 hover:border-slate-300";
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setClassName(c.name)}
                        className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${tone}`}
                      >
                        <span className={`text-sm font-black ${full ? "text-red-600" : "text-slate-800"}`}>
                          {c.name}
                        </span>
                        <span className={`shrink-0 text-xs font-bold ${full ? "text-red-600" : "text-slate-500"}`}>
                          {full ? `마감 · 예비 ${c.waitingCount + 1}번` : `${c.confirmedCount}/${capacity}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {hasTeammates && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-slate-500">같이 하고 싶은 팀원 (선택, 최대 3명)</span>
                    {teammates.map((t, i) => (
                      <input
                        key={i}
                        type="text"
                        value={t}
                        onChange={(e) =>
                          setTeammates((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                        }
                        placeholder={`팀원 이름 ${i + 1}`}
                        className={INPUT_CLASS}
                      />
                    ))}
                  </div>
                )}

                {className && !selectedFull && <PaymentPicker file={paymentFile} onChange={setPaymentFile} />}
                {className && selectedFull && (
                  <p className="text-xs font-bold text-red-600">예비 신청은 입금하지 않습니다.</p>
                )}

                {error && <p className="text-sm font-medium text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting || !classes}
                  className={`rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50 ${
                    selectedFull ? "bg-red-600 hover:bg-red-700" : "bg-[#1E3A8A] hover:bg-blue-800"
                  }`}
                >
                  {submitting ? "신청 중..." : selectedFull ? "예비 신청하기" : "신청하기"}
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
                <p className="text-lg font-black text-[#1E3A8A]">{mineResult.className}</p>
                <p
                  className={`text-sm font-bold ${
                    mineResult.result.status === "confirmed" ? "text-slate-700" : "text-red-600"
                  }`}
                >
                  {resultText(mineResult.result)}
                </p>

                {mineResult.needsPayment && (
                  <div className="mt-2 flex w-full flex-col gap-3 text-left">
                    <p className="text-xs font-bold text-[#1E3A8A]">
                      예비에서 확정으로 전환되었습니다. 입금 후 스크린샷을 올려주세요.
                    </p>
                    <PaymentPicker file={minePaymentFile} onChange={setMinePaymentFile} />
                    {mineError && <p className="text-sm font-medium text-red-600">{mineError}</p>}
                    <button
                      type="button"
                      onClick={handleMinePayment}
                      disabled={minePaying}
                      className="rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
                    >
                      {minePaying ? "제출 중..." : "입금 확인 제출"}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMineResult(null);
                    switchMode("apply");
                  }}
                  className="mt-3 rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                >
                  돌아가기
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
                    className={INPUT_CLASS}
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
                    className={INPUT_CLASS}
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
