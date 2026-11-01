"use client";

import { DynamicPopupModal } from "./DynamicPopupModal";

// 홈커밍데이 신청 팝업 (코드로 만든 팝업). 화면은 동적 팝업과 같은 모양을 쓰고,
// 본인 취소와 예비번호 연락(이메일) 기능을 켭니다.
export function HomecomingModal({ autoOpen = false }: { autoOpen?: boolean }) {
  return (
    <DynamicPopupModal
      slug="homecoming"
      apiBase="/api/homecoming"
      autoOpen={autoOpen}
      selfCancel
      waitlistContact
    />
  );
}
