"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { DynamicPopupModal } from "./DynamicPopupModal";

type PopupOption = { slug: string; title: string };

const DISMISS_KEY = "chiro-dynamic-popup-selector-dismissed-until";

function getInitialOpenState(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const until = window.localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < Number(until)) return false;
  } catch {
    // 프라이빗 모드 등으로 localStorage를 못 쓰면 그냥 보여줍니다.
  }
  return true;
}

// 홈페이지 진입 시, "홈페이지 자동 팝업"으로 설정된 동적 팝업이 여러 개면 선택 화면을 보여주고,
// 하나뿐이면 선택 화면 없이 바로 그 팝업을 엽니다. 튜터링/교육 신청을 동시에 받던 기존
// QuickApplyModal과 동일한 동작 방식이지만, 관리자가 새로 만든 팝업 전용입니다.
export function DynamicPopupSelector({ popups }: { popups: PopupOption[] }) {
  const visibleCount = popups.length;
  const only = visibleCount === 1 ? popups[0] : null;

  const [open, setOpen] = useState(() => (visibleCount > 1 ? getInitialOpenState() : false));
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(only ? only.slug : null);
  const [openCount, setOpenCount] = useState(() => (only ? 1 : 0));

  if (visibleCount === 0) return null;

  function closeModal() {
    if (dontShowAgain) {
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
      } catch {
        // 저장 실패해도 닫기는 정상 진행
      }
    }
    setOpen(false);
  }

  function choose(slug: string) {
    setSelectedSlug(slug);
    setOpenCount((c) => c + 1);
    setOpen(false);
  }

  function backToSelector() {
    setOpenCount(0);
    setOpen(true);
  }

  const chooser = open && (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm sm:px-6"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">CHIRO</p>
            <h2 className="text-xl font-black text-slate-800">신청하기</h2>
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
            <label className="flex cursor-pointer items-center gap-1 text-[10px] font-bold whitespace-nowrap text-slate-400">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-3 w-3 accent-[#1E3A8A]"
              />
              24시간 보지 않기
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {popups.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => choose(p.slug)}
              className={
                i === 0
                  ? "rounded-xl bg-[#1E3A8A] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
                  : "rounded-xl border-2 border-[#1E3A8A] bg-white px-5 py-4 text-sm font-bold text-[#1E3A8A] transition hover:bg-blue-50"
              }
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {typeof document !== "undefined" && chooser ? createPortal(chooser, document.body) : null}
      {openCount > 0 && selectedSlug && (
        <DynamicPopupModal
          key={openCount}
          slug={selectedSlug}
          autoOpen={visibleCount === 1}
          onBack={visibleCount > 1 ? backToSelector : undefined}
        />
      )}
    </>
  );
}
