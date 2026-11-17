"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const MONTHS = ["2월", "8월"] as const;
const CAREERS = ["회사", "대학원"] as const;

const inputClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]";

// 졸업생 본인 정보 등록 팝업. 모든 항목은 선택 입력입니다.
export function AlumniRegisterButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
      >
        졸업생 정보 등록하기
      </button>
      {open && <AlumniRegisterModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AlumniRegisterModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [graduationMonth, setGraduationMonth] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [career, setCareer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const isEmpty = !name.trim() && !graduationYear.trim() && !graduationMonth && !phone.trim() && !email.trim() && !career;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEmpty) {
      setError("한 가지 이상 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, graduationYear, graduationMonth, phone, email, career }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "등록 중 오류가 발생했습니다.");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm sm:px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white bg-white p-6 text-left shadow-2xl sm:max-w-md sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">CHIRO</p>
            <h2 className="text-xl font-black text-slate-800">졸업생 정보 등록</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-lg font-black text-[#1E3A8A]">등록되었습니다</p>
            <p className="text-sm font-medium text-slate-500">소중한 정보 감사합니다.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
            >
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm font-medium break-keep text-slate-500">
              모든 항목은 선택 입력입니다. 원하는 항목만 적어주세요.
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">졸업연도</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="2026"
                  className={`${inputClass} min-w-0 flex-1`}
                />
                {MONTHS.map((m) => (
                  <ChoiceButton
                    key={m}
                    label={m}
                    selected={graduationMonth === m}
                    onClick={() => setGraduationMonth(graduationMonth === m ? "" : m)}
                  />
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">이름</span>
              <input
                type="text"
                maxLength={30}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">전화번호</span>
              <input
                type="tel"
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">이메일</span>
              <input
                type="email"
                maxLength={100}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@cau.ac.kr"
                className={inputClass}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">진학 분야</span>
              <div className="flex gap-2">
                {CAREERS.map((c) => (
                  <ChoiceButton
                    key={c}
                    label={c}
                    selected={career === c}
                    onClick={() => setCareer(career === c ? "" : c)}
                    grow
                  />
                ))}
              </div>
            </div>

            <p className="text-[11px] leading-relaxed font-medium break-keep text-slate-400">
              전화번호는 운영진만 확인하며 홈페이지에 공개되지 않습니다. 이름, 졸업연도, 진학 분야, 이메일은
              졸업생 페이지에 표시됩니다.
            </p>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || isEmpty}
              className="mt-1 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "등록 중..." : "등록하기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

function ChoiceButton({
  label,
  selected,
  onClick,
  grow = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  grow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${grow ? "flex-1" : "shrink-0"} rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
        selected
          ? "border-[#1E3A8A] bg-[#1E3A8A] text-white"
          : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
