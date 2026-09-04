"use client";

import { useState } from "react";
import { TrainingModal } from "./TrainingModal";

export function TrainingButton() {
  const [openCount, setOpenCount] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenCount((c) => c + 1)}
        className="rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
      >
        프린터기·인두기 교육 신청
      </button>
      {openCount > 0 && <TrainingModal key={openCount} />}
    </>
  );
}
