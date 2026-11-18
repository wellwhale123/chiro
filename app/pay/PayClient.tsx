"use client";

import { useEffect } from "react";
import { CopyButton } from "../components/CopyButton";

const BANK_NAME = "토스뱅크";
const ACCOUNT_NUMBER = "1002-4084-6167";
const ACCOUNT_HOLDER = "옥소이";

// 금액은 비워두고 받는 계좌만 채웁니다(휴대폰에 토스 앱이 있을 때만 동작).
const TOSS_SEND_URL = `supertoss://send?bank=${encodeURIComponent(BANK_NAME)}&accountNo=${ACCOUNT_NUMBER.replace(/-/g, "")}`;

export function PayClient() {
  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    // QR로 들어온 휴대폰은 바로 토스 송금 화면을 엽니다. 토스가 없으면 아무 일도 없고 이 화면이 그대로 남습니다.
    if (mobile) window.location.href = TOSS_SEND_URL;
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-black text-slate-800">CHIRO 입금 안내</h1>
        <p className="mt-1 text-xs font-medium break-keep text-slate-500">
          토스 앱이 자동으로 열리지 않으면 아래 버튼을 누르거나 계좌번호를
          복사해 송금해 주세요.
        </p>

        <div className="mt-5 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500">
              {BANK_NAME} ({ACCOUNT_HOLDER})
            </span>
            <span className="text-base font-black tracking-wide text-slate-800">
              {ACCOUNT_NUMBER}
            </span>
          </div>
          <CopyButton text={`${BANK_NAME} ${ACCOUNT_NUMBER}`} />
        </div>

        <a
          href={TOSS_SEND_URL}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#0064FF] py-3 text-sm font-black text-white transition hover:brightness-110"
        >
          토스로 바로 송금하기
        </a>
        <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
          토스 바로 송금은 휴대폰에서만 동작합니다.
        </p>
      </div>
    </div>
  );
}
