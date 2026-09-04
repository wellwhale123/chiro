"use client";

import { useState } from "react";
import { TutoringModal } from "./TutoringModal";

export function TutoringButton() {
  const [openCount, setOpenCount] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenCount((c) => c + 1)}
        className="rounded-xl border-2 border-[#1E3A8A] bg-white px-5 py-3 text-sm font-bold text-[#1E3A8A] shadow-sm transition hover:bg-blue-50"
      >
        튜터링 신청
      </button>
      {openCount > 0 && <TutoringModal key={openCount} />}
    </>
  );
}
