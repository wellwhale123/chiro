"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Copy, Check, ArrowLeft } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import {
  ROBOTHON_AGREEMENT,
  ROBOTHON_CANCEL_GUIDE,
  ROBOTHON_DEPOSIT_AMOUNT,
  ROBOTHON_TEAMS,
} from "@/lib/robothonShared";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

// 입금 안내 (튜터링과 동일한 계좌)
const BANK_NAME = "토스뱅크";
const ACCOUNT_NUMBER = "1002-4084-6167";
const ACCOUNT_HOLDER = "옥소이";

// 토스 앱 송금 화면을 받는 사람/금액이 채워진 상태로 엽니다(휴대폰에 토스 앱이 있을 때만 동작).
const TOSS_SEND_URL = `supertoss://send?bank=${encodeURIComponent(BANK_NAME)}&accountNo=${ACCOUNT_NUMBER.replace(
  /-/g,
  ""
)}&amount=${ROBOTHON_DEPOSIT_AMOUNT}`;

const DISMISS_KEY = "chiro-robothon-modal-dismissed-until";
const INPUT_CLASS =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]";

type TeamStats = { name: string; capacity: number | null; remaining: number | null; waitingCount: number };
type SubmitResult = { status: "confirmed"; rank: number } | { status: "waitlisted"; waitNumber: number };
type Mode = "apply" | "mine";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

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
  depositorName,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  depositorName: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [isMobile] = useState(
    () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );

  async function handleCopy() {
    const ok = await copyText(`${BANK_NAME} ${ACCOUNT_NUMBER}`);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const depositor = `${depositorName.trim() || "이름"}_로보톤`;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-slate-500">입금 확인 스크린샷</span>

      <div className="flex flex-col gap-2 rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-black break-keep text-slate-800">
            {BANK_NAME} {ACCOUNT_NUMBER}
            <span className="ml-1 text-xs font-bold text-slate-500">({ACCOUNT_HOLDER})</span>
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
        <span className="text-xs font-bold text-slate-600">금액 : {ROBOTHON_DEPOSIT_AMOUNT.toLocaleString()}원</span>
        <span className="text-xs font-bold text-slate-600">
          입금 형식 : <span className="text-[#1E3A8A]">{depositor}</span>
        </span>
        <span className="text-xs font-bold break-keep text-red-600">
          송금할 때 받는 분 통장 표시 이름을 반드시 &quot;{depositor}&quot;로 바꿔서 보내주세요. 형식이 다르면 입금
          확인이 안 될 수 있어요.
        </span>
        {isMobile && (
          <a
            href={TOSS_SEND_URL}
            className="mt-1 rounded-lg bg-[#0064FF] px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-[#0050CC]"
          >
            토스로 바로 송금하기
          </a>
        )}
      </div>

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
    </div>
  );
}

export function RobothonModal({ autoOpen = false, onBack }: { autoOpen?: boolean; onBack?: () => void }) {
  const [open, setOpen] = useState(() => getInitialOpenState(autoOpen));
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [mode, setMode] = useState<Mode>("apply");

  const [teamStats, setTeamStats] = useState<TeamStats[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [team, setTeam] = useState<string | null>(null);
  const [teammate, setTeammate] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reapplied: boolean; result: SubmitResult } | null>(null);

  const [mineName, setMineName] = useState("");
  const [mineStudentId, setMineStudentId] = useState("");
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineResult, setMineResult] = useState<SubmitResult | null>(null);

  function loadStats() {
    fetch("/api/robothon", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setTeamStats(data.teams ?? []);
        else setLoadError(data?.error || "팝업을 불러오지 못했습니다.");
      })
      .catch(() => setLoadError("팝업을 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadStats();
  }, []);

  if (!open) return null;

  const statsOf = (t: string) => teamStats?.find((s) => s.name === t) ?? null;
  const selectedStats = team ? statsOf(team) : null;
  // 선택한 팀의 여석이 없으면 예비번호로 등록되므로 입금을 받지 않습니다.
  const willBeFull = selectedStats?.remaining !== null && selectedStats?.remaining !== undefined && selectedStats.remaining <= 0;

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
    if (!team) {
      setError("팀을 선택해 주세요.");
      return;
    }
    if (!agreed) {
      setError("동의서를 읽고 동의에 체크해 주세요.");
      return;
    }
    if (!hasSignature) {
      setError("동의서에 서명해 주세요.");
      return;
    }
    if (!willBeFull && !paymentFile) {
      setError("입금 확인 스크린샷을 첨부해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const signatureFile = await signatureRef.current?.toFile(`signature-${studentId.trim()}.png`);
      if (!signatureFile) throw new Error("서명을 저장하지 못했습니다. 다시 서명해 주세요.");

      const form = new FormData();
      form.set("name", name.trim());
      form.set("studentId", studentId.trim());
      form.set("team", team);
      if (teammate.trim()) form.set("teammate1", teammate.trim());
      form.set("agree", "true");
      form.set("signatureFile", signatureFile);
      // 예비 신청은 입금을 받지 않으므로 파일을 보내지 않습니다.
      if (!willBeFull && paymentFile) form.set("paymentFile", await compressImage(paymentFile));

      const res = await fetch("/api/robothon", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "신청 중 오류가 발생했습니다.");

      setDone({ reapplied: Boolean(data.reapplied), result: data.result });
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
      const res = await fetch("/api/robothon/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mineName.trim(), studentId: mineStudentId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "조회 중 오류가 발생했습니다.");
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
    setMineResult(null);
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
              <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">CHIRO × 현대모비스</p>
              <h2 className="text-xl font-black text-slate-800">{mode === "apply" ? "로보톤 신청" : "내 신청 확인"}</h2>
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

        {mode === "apply" &&
          (done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-lg font-black text-[#1E3A8A]">
                {done.reapplied ? "재신청이 완료되었습니다" : "신청이 완료되었습니다"}
              </p>
              <p className="text-sm font-bold text-slate-700">{resultText(done.result)}</p>
              {done.reapplied && (
                <p className="text-xs font-medium text-slate-500">재신청이라 신청 순위가 맨 뒤로 이동했습니다.</p>
              )}
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
              <div className="mb-5 text-sm font-medium break-keep text-slate-500">
                <p>CHIRO × 현대모비스 로보톤 참가 신청입니다. 아래 동의서를 읽고 서명한 뒤 신청해 주세요.</p>
                <p className="mt-3">팀별 정원은 비전 18명, 키네마틱스 18명이며 정원이 차면 예비번호로 등록됩니다.</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">이름</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    className={INPUT_CLASS}
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

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">팀 (하나만 선택)</span>
                  <div className="grid grid-cols-2 gap-2">
                    {ROBOTHON_TEAMS.map((t) => {
                      const s = statsOf(t);
                      const full = s?.remaining !== null && s?.remaining !== undefined && s.remaining <= 0;
                      const selected = team === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTeam(t)}
                          aria-pressed={selected}
                          className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-3 transition ${
                            selected
                              ? "border-[#1E3A8A] bg-[#1E3A8A] text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
                          }`}
                        >
                          <span className="text-sm font-bold">{t}</span>
                          <span
                            className={`text-xs font-bold ${
                              selected ? "text-blue-100" : full ? "text-red-600" : "text-slate-400"
                            }`}
                          >
                            {!s || s.remaining === null
                              ? "여석 : -"
                              : full
                                ? `여석 : 0 (예비 ${s.waitingCount}명)`
                                : `여석 : ${s.remaining}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">같이 하고 싶은 팀원 (선택, 1명)</span>
                  <input
                    type="text"
                    value={teammate}
                    onChange={(e) => setTeammate(e.target.value)}
                    placeholder="팀원 이름"
                    className={INPUT_CLASS}
                  />
                  <span className="text-xs font-medium break-keep text-slate-400">
                    서로가 서로를 지정해야 반영됩니다. 한 명이라도 상대를 지명하지 않으면 무효입니다.
                  </span>
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">참가 동의서</span>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed break-keep text-slate-600">
                    {ROBOTHON_AGREEMENT.map((section) => (
                      <div key={section.title} className="mb-3 last:mb-0">
                        <p className="mb-1 font-black text-slate-700">{section.title}</p>
                        <ul className="list-disc space-y-0.5 pl-4">
                          {section.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <label className="mt-1 flex cursor-pointer items-start gap-2 text-sm font-bold break-keep text-slate-700">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E3A8A]"
                    />
                    위 동의서 내용을 모두 읽었으며 이에 동의합니다.
                  </label>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">서명</span>
                    <button
                      type="button"
                      onClick={() => signatureRef.current?.clear()}
                      className="text-xs font-bold text-slate-400 underline underline-offset-2 hover:text-slate-600"
                    >
                      지우기
                    </button>
                  </div>
                  <SignaturePad ref={signatureRef} onChange={setHasSignature} />
                  <span className="text-xs font-medium text-slate-400">칸 안에 손가락이나 마우스로 서명해 주세요.</span>
                </div>

                {willBeFull ? (
                  <p className="text-xs font-bold break-keep text-red-600">
                    {team} 팀은 정원이 차서 예비번호로 등록됩니다. 예비 신청은 입금하지 않습니다.
                  </p>
                ) : (
                  <PaymentPicker file={paymentFile} onChange={setPaymentFile} depositorName={name} />
                )}

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
              <p className="mt-4 text-center text-xs font-bold break-keep text-red-600">{ROBOTHON_CANCEL_GUIDE}</p>
            </>
          ))}

        {mode === "mine" &&
          (mineResult ? (
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
                  className={INPUT_CLASS}
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
          ))}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
