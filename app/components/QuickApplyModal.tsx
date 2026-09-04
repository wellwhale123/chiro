"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { TrainingModal } from "./TrainingModal";
import { TutoringModal } from "./TutoringModal";

const DISMISS_KEY = "chiro-quick-apply-modal-dismissed-until";

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

// 홈페이지 진입 시 뜨는 선택 팝업: "프린터기·인두기 교육 신청" / "튜터링 신청" 버튼 두 개를 보여주고,
// 하나를 누르면 그 신청 팝업이 대신 열립니다.
export function QuickApplyModal({
  showTraining,
  showTutoring,
}: {
  showTraining: boolean;
  showTutoring: boolean;
}) {
  const [open, setOpen] = useState(getInitialOpenState);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [trainingOpenCount, setTrainingOpenCount] = useState(0);
  const [tutoringOpenCount, setTutoringOpenCount] = useState(0);

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

  function chooseTraining() {
    setTrainingOpenCount((c) => c + 1);
    setOpen(false);
  }

  function chooseTutoring() {
    setTutoringOpenCount((c) => c + 1);
    setOpen(false);
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
          {showTraining && (
            <button
              type="button"
              onClick={chooseTraining}
              className="rounded-xl bg-[#1E3A8A] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
            >
              프린터기·인두기 교육 신청
            </button>
          )}
          {showTutoring && (
            <button
              type="button"
              onClick={chooseTutoring}
              className="rounded-xl border-2 border-[#1E3A8A] bg-white px-5 py-4 text-sm font-bold text-[#1E3A8A] transition hover:bg-blue-50"
            >
              튜터링 신청
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {typeof document !== "undefined" && chooser ? createPortal(chooser, document.body) : null}
      {trainingOpenCount > 0 && <TrainingModal key={trainingOpenCount} />}
      {tutoringOpenCount > 0 && <TutoringModal key={tutoringOpenCount} />}
    </>
  );
}
