"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

const CLICK_THRESHOLD = 10;
const CLICK_WINDOW_MS = 3000;

// 눈에 띄지 않는 요소(예: 푸터 저작권 문구)를 감싸서, 짧은 시간 안에 여러 번 클릭하면
// 관리자 로그인 창을 띄웁니다. 커서/호버 스타일을 일부러 바꾸지 않아서
// "여기 뭔가 있다"는 시각적 힌트를 주지 않습니다.
export function SilentAdminTrigger({ children }: { children: React.ReactNode }) {
  const clickTimestamps = useRef<number[]>([]);
  const [showModal, setShowModal] = useState(false);

  function handleClick() {
    const now = Date.now();
    clickTimestamps.current = [
      ...clickTimestamps.current.filter((t) => now - t < CLICK_WINDOW_MS),
      now,
    ];

    if (clickTimestamps.current.length >= CLICK_THRESHOLD) {
      clickTimestamps.current = [];
      setShowModal(true);
    }
  }

  return (
    <>
      <span onClick={handleClick}>{children}</span>
      {showModal && <AdminLoginModal onClose={() => setShowModal(false)} />}
    </>
  );
}

function AdminLoginModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        setLoading(false);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  if (typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">
          Admin Access
        </p>
        <h2 className="mb-6 text-xl font-black text-slate-800">관리자 모드 진입</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "확인 중..." : "입장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
