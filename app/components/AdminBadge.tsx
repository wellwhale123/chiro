"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminBadge() {
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-white bg-white/90 px-5 py-3 shadow-xl backdrop-blur-md">
      <span className="flex items-center gap-2 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">
        <span className="h-2 w-2 rounded-full bg-[#1E3A8A]" />
        관리자 모드
      </span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {loggingOut ? "..." : "종료"}
      </button>
    </div>
  );
}
