"use client";

import { useState } from "react";
import { TrainingModal } from "./TrainingModal";

// 공지 카드(서버 컴포넌트로 렌더링된 결과)를 그대로 children으로 받아 감싸고,
// 클릭하면 프린터기·인두기 교육 신청 팝업을 새로 마운트해서 엽니다.
export function TrainingNoticeOpener({ children }: { children: React.ReactNode }) {
  const [openCount, setOpenCount] = useState(0);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpenCount((c) => c + 1)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpenCount((c) => c + 1);
        }}
        className="cursor-pointer"
      >
        {children}
      </div>
      {openCount > 0 && <TrainingModal key={openCount} />}
    </>
  );
}
