"use client";

import { useState } from "react";
import { OpeningRegistrationModal } from "./OpeningRegistrationModal";

// 홈페이지처럼 자동으로 뜨지 않고, 버튼을 눌렀을 때만 개강총회 신청 팝업을 엽니다.
// openCount를 key로 써서 누를 때마다 모달을 새로 마운트합니다 (모달이 내부적으로 열림 상태를 스스로 관리하기 때문).
export function OpeningRegistrationButton({ className }: { className?: string }) {
  const [openCount, setOpenCount] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenCount((c) => c + 1)}
        className={
          className ??
          "rounded-xl bg-[#1E3A8A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
        }
      >
        개강총회 신청
      </button>
      {openCount > 0 && <OpeningRegistrationModal key={openCount} />}
    </>
  );
}
