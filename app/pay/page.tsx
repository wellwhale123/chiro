import type { Metadata } from "next";
import { PayClient } from "./PayClient";

// 인쇄용 QR코드가 가리키는 입금 안내 페이지입니다.
// "계좌번호 복사"와 "토스로 바로 입금"(받는 계좌가 채워진 송금 화면) 두 버튼 중 하나를 고릅니다.
// QR은 이 주소(/pay)만 담고 있어서 계좌가 바뀌면 PayClient.tsx의 상수만 고치면 됩니다.

export const metadata: Metadata = {
  title: "입금 안내 - CHIRO",
  description: "CHIRO 입금 계좌 안내",
  robots: { index: false, follow: false },
};

export default function PayPage() {
  return <PayClient />;
}
