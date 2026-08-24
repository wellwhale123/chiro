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

type StatusResult =
  | { cancelled: true }
  | { cancelled: false; status: "confirmed"; rank?: number }
  | { cancelled: false; status: "waitlist"; waitlistNumber?: number };

type Mode = "apply" | "cancel" | "status";

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// 이름/학번 + 학교 이메일 인증코드까지 담는 신청/취소 공통 폼 상태.
// email이 바뀌면 이전에 받은 인증코드는 자동으로 무효화(초기화)됩니다.
function useEmailOtp() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmailRaw] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSentMessage, setCodeSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailValid = email.trim().toLowerCase().endsWith("@cau.ac.kr");

  function setEmail(value: string) {
    setEmailRaw(value);
    setOtpToken(null);
    setCodeSentMessage(null);
  }

  async function sendCode() {
    if (!emailValid) {
      setError("학교 이메일(@cau.ac.kr)을 입력해 주세요.");
      return;
    }
    setSendingCode(true);
    setError(null);
    setCodeSentMessage(null);

    try {
      const res = await fetch("/api/opening/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "인증코드 발송에 실패했습니다.");
      }
      setOtpToken(data.token);
      setCode("");
      setCodeSentMessage("인증코드를 이메일로 보냈어요. 받은 코드를 입력해 주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSendingCode(false);
    }
  }

  function reset() {
    setName("");
    setStudentId("");
    setEmailRaw("");
    setOtpToken(null);
    setCode("");
    setCodeSentMessage(null);
    setError(null);
  }

  return {
    name,
    setName,
    studentId,
    setStudentId,
    email,
    setEmail,
    emailValid,
    otpToken,
    code,
    setCode,
    sendingCode,
    codeSentMessage,
    sendCode,
    error,
    setError,
    reset,
  };
}

type EmailOtpState = ReturnType<typeof useEmailOtp>;

// 이름/학번/학교 이메일 인증 입력 필드 묶음 (신청 폼, 취소 폼에서 공통으로 사용)
function EmailOtpFields({ form, autoFocus }: { form: EmailOtpState; autoFocus?: boolean }) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-slate-500">이름</span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder="홍길동"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
          autoFocus={autoFocus}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-slate-500">학번</span>
        <input
          type="text"
          inputMode="numeric"
          value={form.studentId}
          onChange={(e) => form.setStudentId(e.target.value)}
          placeholder="20231234"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-slate-500">학교 이메일</span>
        <div className="flex gap-2">
          <input
            type="email"
            value={form.email}
            onChange={(e) => form.setEmail(e.target.value)}
            placeholder="example@cau.ac.kr"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
          />
          <button
            type="button"
            onClick={form.sendCode}
            disabled={form.sendingCode || !form.emailValid}
            className="shrink-0 whitespace-nowrap rounded-xl border border-[#1E3A8A] px-3 py-2.5 text-xs font-bold text-[#1E3A8A] transition hover:bg-blue-50 disabled:opacity-40"
          >
            {form.sendingCode ? "발송 중..." : form.otpToken ? "재전송" : "인증코드 받기"}
          </button>
        </div>
      </label>

      {form.otpToken && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-500">인증코드</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.code}
            onChange={(e) => form.setCode(e.target.value)}
            placeholder="6자리 숫자"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
          />
          {form.codeSentMessage && (
            <span className="text-xs font-medium text-[#1E3A8A]">{form.codeSentMessage}</span>
          )}
        </label>
      )}

      {form.error && <p className="text-sm font-medium text-red-600">{form.error}</p>}
    </>
  );
}

function validateEmailOtpForm(form: EmailOtpState, requireNameAndId: boolean): string | null {
  if (requireNameAndId && (!form.name.trim() || !form.studentId.trim())) {
    return "이름과 학번을 모두 입력해 주세요.";
  }
  if (!form.emailValid) return "학교 이메일(@cau.ac.kr)을 입력해 주세요.";
  if (!form.otpToken) return "먼저 이메일 인증코드를 받아주세요.";
  if (!form.code.trim()) return "인증코드를 입력해 주세요.";
  return null;
}

export function OpeningRegistrationModal() {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("apply");
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [info, setInfo] = useState<CapacityInfo | null>(null);
  const [started, setStarted] = useState<boolean | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const applyForm = useEmailOtp();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const cancelForm = useEmailOtp();
  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState<{ alreadyCancelled: boolean } | null>(null);

  const [statusName, setStatusName] = useState("");
  const [statusStudentId, setStatusStudentId] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);

  function loadInfo() {
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
          setStarted(Boolean(data.started));
          setStartTime(typeof data.startTime === "string" ? data.startTime : null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
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

  const remaining = info ? Math.max(0, info.capacity - info.confirmedCount) : null;
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
    const validationError = validateEmailOtpForm(applyForm, true);
    if (validationError) {
      applyForm.setError(validationError);
      return;
    }

    setSubmitting(true);
    applyForm.setError(null);

    try {
      const res = await fetch("/api/opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: applyForm.name.trim(),
          studentId: applyForm.studentId.trim(),
          email: applyForm.email.trim().toLowerCase(),
          code: applyForm.code.trim(),
          token: applyForm.otpToken,
        }),
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
      applyForm.setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateEmailOtpForm(cancelForm, true);
    if (validationError) {
      cancelForm.setError(validationError);
      return;
    }

    setCancelling(true);
    cancelForm.setError(null);

    try {
      const res = await fetch("/api/opening/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cancelForm.name.trim(),
          studentId: cancelForm.studentId.trim(),
          email: cancelForm.email.trim().toLowerCase(),
          code: cancelForm.code.trim(),
          token: cancelForm.otpToken,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "취소 처리 중 오류가 발생했습니다.");
      }

      setCancelDone({ alreadyCancelled: Boolean(data.alreadyCancelled) });
      loadInfo(); // 취소로 자리가 비었을 수 있으니 현황을 다시 불러옵니다.
    } catch (err) {
      cancelForm.setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!statusName.trim() || !statusStudentId.trim()) {
      setStatusError("이름과 학번을 모두 입력해 주세요.");
      return;
    }

    setCheckingStatus(true);
    setStatusError(null);

    try {
      const res = await fetch("/api/opening/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: statusName.trim(), studentId: statusStudentId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "번호 확인 중 오류가 발생했습니다.");
      }

      if (data.cancelled) {
        setStatusResult({ cancelled: true });
      } else if (data.status === "confirmed") {
        setStatusResult({ cancelled: false, status: "confirmed", rank: data.rank });
      } else {
        setStatusResult({ cancelled: false, status: "waitlist", waitlistNumber: data.waitlistNumber });
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setCheckingStatus(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    applyForm.setError(null);
    cancelForm.setError(null);
    setStatusError(null);
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
            <h2 className="text-xl font-black text-slate-800">
              {mode === "apply" && "개강총회 신청"}
              {mode === "cancel" && "개강총회 신청 취소"}
              {mode === "status" && "내 신청 번호 확인"}
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
          (started === null ? (
            <p className="py-10 text-center text-sm font-medium text-slate-500">
              신청 현황을 불러오는 중...
            </p>
          ) : !started ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm font-bold text-slate-400">접수 시작까지</p>
              <p className="font-black tabular-nums text-[#1E3A8A] text-4xl">
                {formatCountdown(countdown)}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {startTimeLabel && `${startTimeLabel}부터 `}선착순으로 신청을 받습니다. 잠시만 기다려 주세요.
              </p>
            </div>
          ) : result ? (
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
                <EmailOtpFields form={applyForm} autoFocus />

                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => switchMode("cancel")}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                  >
                    신청 취소
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

              <button
                type="button"
                onClick={() => switchMode("status")}
                className="mt-4 w-full text-center text-sm font-bold text-blue-600 underline decoration-2 underline-offset-2 transition hover:text-blue-700"
              >
                현재 본인 번호 확인
              </button>
            </>
          ))}

        {mode === "cancel" &&
          (cancelDone ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-lg font-black text-slate-800">
                {cancelDone.alreadyCancelled ? "이미 취소된 신청이에요" : "취소되었습니다"}
              </p>
              <p className="text-sm font-medium text-slate-500">
                {cancelDone.alreadyCancelled
                  ? "해당 신청은 이전에 이미 취소 처리되었어요."
                  : "신청이 취소되어 자리가 뒷사람에게 자동으로 넘어갑니다."}
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
                신청하신 이름·학번과, 본인 확인을 위한 학교 이메일 인증코드를 입력하시면 취소해드려요.
              </p>

              <form onSubmit={handleCancelSubmit} className="flex flex-col gap-4">
                <EmailOtpFields form={cancelForm} autoFocus />

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
                    disabled={cancelling}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelling ? "취소 처리 중..." : "취소하기"}
                  </button>
                </div>
              </form>
            </>
          ))}

        {mode === "status" &&
          (statusResult ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              {statusResult.cancelled ? (
                <>
                  <p className="text-lg font-black text-slate-800">취소된 신청이에요</p>
                  <p className="text-sm font-medium text-slate-500">다시 참여하시려면 새로 신청해 주세요.</p>
                </>
              ) : statusResult.status === "confirmed" ? (
                <>
                  <p className="text-lg font-black text-[#1E3A8A]">신청이 확정되어 있어요</p>
                  {statusResult.rank !== undefined && (
                    <p className="text-sm font-medium text-slate-500">확정 순번 {statusResult.rank}번째예요.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-lg font-black text-slate-800">
                    예비번호 {String(statusResult.waitlistNumber ?? 0).padStart(2, "0")}번
                  </p>
                  <p className="text-sm font-medium text-slate-500">정원이 마감되어 예비 명단에 있어요.</p>
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
                신청하신 이름과 학번을 입력하시면 현재 순번을 알려드려요.
              </p>

              <form onSubmit={handleStatusSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">이름</span>
                  <input
                    type="text"
                    value={statusName}
                    onChange={(e) => setStatusName(e.target.value)}
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
                    value={statusStudentId}
                    onChange={(e) => setStatusStudentId(e.target.value)}
                    placeholder="20231234"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                  />
                </label>

                {statusError && <p className="text-sm font-medium text-red-600">{statusError}</p>}

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
                    disabled={checkingStatus}
                    className="flex-1 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
                  >
                    {checkingStatus ? "확인 중..." : "확인하기"}
                  </button>
                </div>
              </form>
            </>
          ))}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
