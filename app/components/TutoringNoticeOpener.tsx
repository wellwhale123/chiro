"use client";

import { useState } from "react";
import { TutoringModal } from "./TutoringModal";

// 공지 카드(서버 컴포넌트로 렌더링된 결과)를 그대로 children으로 받아 감싸고,
// 클릭하면 튜터링 신청 팝업을 새로 마운트해서 엽니다.
export function TutoringNoticeOpener({ children }: { children: React.ReactNode }) {
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
      {openCount > 0 && <TutoringModal key={openCount} />}
    </>
  );
}
