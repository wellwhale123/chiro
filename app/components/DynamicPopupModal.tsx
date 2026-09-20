"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload, ArrowLeft } from "lucide-react";

type PopupField = {
  name: string;
  type: "title" | "rich_text" | "number" | "files" | "checkbox" | "date" | "select";
  options?: string[];
};

type PopupResult =
  | { status: "confirmed"; rank: number }
  | { status: "waitlisted"; waitNumber: number };

type PopupInfo = {
  title: string;
  description: string;
  capacity: number | null;
  useWaitlist: boolean;
  depositAmount: number | null;
  fields: PopupField[];
  teamSlotCount: number | null;
  cancelManager: string;
  checkRoster: boolean;
  periodOver: boolean;
};

function resultText(result: PopupResult): string {
  return result.status === "confirmed" ? `확정 순번 ${result.rank}번째` : `예비번호 ${result.waitNumber}번`;
}

function dismissKey(slug: string) {
  return `chiro-popup-${slug}-dismissed-until`;
}

function getInitialOpenState(slug: string, autoOpen: boolean): boolean {
  if (!autoOpen) return true;
  if (typeof window === "undefined") return true;
  try {
    const until = window.localStorage.getItem(dismissKey(slug));
    if (until && Date.now() < Number(until)) return false;
  } catch {
    // 프라이빗 모드 등으로 localStorage를 못 쓰면 그냥 보여줍니다.
  }
  return true;
}

type Mode = "apply" | "mine";

export function DynamicPopupModal({
  slug,
  autoOpen = false,
  onBack,
}: {
  slug: string;
  autoOpen?: boolean;
  onBack?: () => void;
}) {
  const [open, setOpen] = useState(() => getInitialOpenState(slug, autoOpen));
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [mode, setMode] = useState<Mode>("apply");
  const [showRefundPolicy, setShowRefundPolicy] = useState(false);

  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  // "명단 체크"가 꺼진 팝업에서, 이름만으로는 명단에서 못 찾았을 때만 학번 입력칸을 보여줍니다.
  const [needStudentId, setNeedStudentId] = useState(false);
  const [teammates, setTeammates] = useState<string[]>([]);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ updated: boolean; result: PopupResult } | null>(null);

  const [mineName, setMineName] = useState("");
  const [mineStudentId, setMineStudentId] = useState("");
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineResult, setMineResult] = useState<PopupResult | null>(null);

  function loadStats() {
    fetch(`/api/popups/${slug}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setPopup(data.popup);
          setConfirmedCount(data.confirmedCount ?? 0);
          setTeammates((t) =>
            data.popup?.teamSlotCount ? Array.from({ length: data.popup.teamSlotCount }, (_, i) => t[i] ?? "") : []
          );
        } else {
          setLoadError(data?.error || "팝업을 불러오지 못했습니다.");
        }
      })
      .catch(() => setLoadError("팝업을 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!open) return null;

  const capacity = popup?.capacity ?? null;
  const remaining = capacity !== null && confirmedCount !== null ? Math.max(0, capacity - confirmedCount) : null;
  const willBeFull = remaining !== null && remaining <= 0;
  const willBeBlocked = willBeFull && popup && !popup.useWaitlist;

  function closeModal() {
    if (dontShowAgain && autoOpen) {
      try {
        window.localStorage.setItem(dismissKey(slug), String(Date.now() + 24 * 60 * 60 * 1000));
      } catch {
        // 저장 실패해도 닫기는 정상 진행
      }
    }
    setOpen(false);
  }

  const extraFields = (popup?.fields ?? []).filter(
    (f) => !["이름", "학번", "학과", "학년", "입금확인", "팀원희망", "신청순위"].includes(f.name) && f.type !== "files"
  );

  // 명단 체크가 꺼진 팝업은 학번 입력칸을 처음엔 안 보여주고, 이름으로 명단 조회를 먼저
  // 시도합니다. 못 찾았을 때만(needStudentId) 학번을 직접 받습니다.
  const rosterCheckOff = popup?.checkRoster === false;
  const showStudentIdField = !rosterCheckOff || needStudentId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (showStudentIdField && !studentId.trim()) {
      setError(needStudentId ? "명단에서 이름을 찾지 못했어요. 학번을 입력해 주세요." : "학번을 입력해 주세요.");
      return;
    }
    if (popup?.depositAmount && !paymentFile && !willBeFull) {
      setError("입금 확인 스크린샷을 첨부해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("name", name.trim());
      if (studentId.trim()) form.set("studentId", studentId.trim());
      teammates.forEach((t, i) => {
        if (t.trim()) form.set(`teammate${i + 1}`, t.trim());
      });
      for (const field of extraFields) {
        const value = extra[field.name];
        if (value !== undefined && value !== "") form.set(field.name, value);
      }
      if (paymentFile) form.set("paymentFile", paymentFile);

      const res = await fetch(`/api/popups/${slug}`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        if (data?.needStudentId) setNeedStudentId(true);
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
      const res = await fetch(`/api/popups/${slug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mineName.trim(), studentId: mineStudentId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "조회 중 오류가 발생했습니다.");
      }
      setMineResult(data.result);
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
          <div className="flex items-start gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="뒤로가기"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">CHIRO</p>
              <h2 className="text-xl font-black text-slate-800">
                {mode === "apply" ? popup?.title ?? "신청" : "내 신청 확인"}
              </h2>
            </div>
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

        {loadError && <p className="text-sm font-medium text-red-600">{loadError}</p>}

        {!loadError && !popup && <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p>}

        {popup &&
          mode === "apply" &&
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
              <div className="mb-5 text-sm font-medium text-slate-500">
                <p>{popup.description}</p>
                {capacity !== null && remaining !== null && (
                  <p className="mt-4">
                    {remaining > 0
                      ? `정원 ${capacity}명이며 현재 여석 ${remaining}자리 남았습니다.`
                      : popup.useWaitlist
                        ? `정원 ${capacity}명이며 정원이 마감되어 예비번호로 등록됩니다.`
                        : "정원이 모두 마감되었습니다."}
                  </p>
                )}
              </div>

              {willBeBlocked ? (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                  정원이 마감되어 더 이상 신청을 받지 않습니다.
                </p>
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
                  {showStudentIdField && (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-500">학번</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="20261234"
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                        autoFocus={needStudentId}
                      />
                    </label>
                  )}

                  {extraFields.map((field) => (
                    <label key={field.name} className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-500">{field.name}</span>
                      {field.type === "select" ? (
                        <select
                          value={extra[field.name] ?? ""}
                          onChange={(e) => setExtra((prev) => ({ ...prev, [field.name]: e.target.value }))}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                        >
                          <option value="">선택 안 함</option>
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={extra[field.name] === "true"}
                          onChange={(e) =>
                            setExtra((prev) => ({ ...prev, [field.name]: e.target.checked ? "true" : "false" }))
                          }
                          className="h-4 w-4 accent-[#1E3A8A]"
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          value={extra[field.name] ?? ""}
                          onChange={(e) => setExtra((prev) => ({ ...prev, [field.name]: e.target.value }))}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                        />
                      )}
                    </label>
                  ))}

                  {popup.teamSlotCount ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-500">
                        같이 하고 싶은 팀원 (선택, 최대 {popup.teamSlotCount}명)
                      </span>
                      {teammates.map((value, i) => (
                        <input
                          key={i}
                          type="text"
                          value={value}
                          onChange={(e) =>
                            setTeammates((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                          }
                          placeholder={`팀원 이름 ${i + 1}`}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                        />
                      ))}
                      <span className="text-xs font-medium text-slate-400">
                        희망하시더라도 팀 구성에 반영이 어려울 수 있습니다. 희망하시는 팀원분들도 각자 똑같이
                        신청서를 작성해 주셔야 해요.
                      </span>
                    </div>
                  ) : null}

                  {popup.depositAmount ? (
                    willBeFull ? (
                      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                        정원이 마감되어 예비번호로 등록됩니다. 확정되기 전까지는 입금하지 말아주세요.
                      </p>
                    ) : (
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-slate-500">입금 확인 스크린샷</span>
                        <span className="text-xs font-bold text-slate-500">
                          (토스뱅크 1002-4084-6167(옥소이) {popup.depositAmount.toLocaleString()}원 입금)
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
                    )
                  ) : null}

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

              <button
                type="button"
                onClick={() => switchMode("mine")}
                className="mt-4 w-full text-center text-sm font-bold text-blue-600 underline decoration-2 underline-offset-2 transition hover:text-blue-700"
              >
                내 신청 확인
              </button>

              {popup.cancelManager && (
                <p className="mt-4 text-center text-xs font-bold text-red-600">
                  취소는 {popup.cancelManager}에게 문의부탁드립니다.{" "}
                  <button
                    type="button"
                    onClick={() => setShowRefundPolicy((v) => !v)}
                    className="underline decoration-2 underline-offset-2"
                  >
                    환불규정
                  </button>
                </p>
              )}

              {showRefundPolicy && (
                <div className="mt-2 rounded-xl bg-slate-50 p-3 text-left text-[11px] leading-relaxed text-slate-600">
                  <p className="mb-1 font-black text-slate-700">제26조 (환불)</p>
                  <p>
                    ① 납부된 참가비는 취소 의사가 회장 또는 담당 임원에게 도달한 시점을 기준으로 다음 각 호에
                    따라 환불한다.
                  </p>
                  <p className="pl-2">1. 신청 마감일 이전에 취소한 경우: 전액 환불</p>
                  <p className="pl-2">
                    2. 신청 마감일 이후 해당 행사를 위한 지출을 집행하기 전에 취소한 경우: 100분의 50 환불
                  </p>
                  <p className="pl-2">3. 회가 해당 행사를 위한 지출을 집행한 이후에 취소한 경우: 환불하지 아니한다.</p>
                  <p className="mt-1">
                    ② 전항 제3호에도 불구하고 다음 각 호의 어느 하나에 해당하는 때에는 임원회의 의결로 환불할
                    수 있다.
                  </p>
                  <p className="pl-2">1. 질병, 사고, 그 밖에 이에 준하는 부득이한 사유를 증빙한 경우</p>
                  <p className="pl-2">2. 대기자 또는 다른 참가자가 그 자리를 승계하여 회에 손실이 발생하지 아니하는 경우</p>
                </div>
              )}
            </>
          ))}

        {mode === "mine" && (
          <>
            {mineResult ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm font-bold text-slate-700">{resultText(mineResult)}</p>
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
