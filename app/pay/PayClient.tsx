"use client";

import { useState } from "react";
import { Check, Copy, Send } from "lucide-react";

const BANK_NAME = "토스뱅크";
const ACCOUNT_NUMBER = "1002-4084-6167";
const ACCOUNT_HOLDER = "옥소이";

// 금액은 비워두고 받는 계좌만 채웁니다(휴대폰에 토스 앱이 있을 때만 동작).
const TOSS_SEND_URL = `supertoss://send?bank=${encodeURIComponent(BANK_NAME)}&accountNo=${ACCOUNT_NUMBER.replace(/-/g, "")}`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 구형 브라우저/인앱 브라우저(카메라 QR, 카카오톡 등) 대비
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function PayClient() {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  async function handleCopy() {
    setCopied(
      (await copyText(`${BANK_NAME} ${ACCOUNT_NUMBER}`)) ? "ok" : "fail",
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-black text-slate-800">CHIRO 입금 안내</h1>

        <div className="mt-4 flex flex-col rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-xs font-bold text-slate-500">
            {BANK_NAME} ({ACCOUNT_HOLDER})
          </span>
          <span className="text-lg font-black tracking-wide text-slate-800">
            {ACCOUNT_NUMBER}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1E3A8A] bg-white py-3.5 text-base font-black text-[#1E3A8A] transition active:scale-[0.98]"
          >
            {copied === "ok" ? (
              <Check className="h-5 w-5" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
            {copied === "ok" ? "복사됨" : "계좌번호 복사"}
          </button>

          {copied === "ok" && (
            <p className="text-center text-xs font-bold break-keep text-[#1E3A8A]">
              계좌번호가 복사됐어요. 쓰시는 은행 앱을 열어 붙여넣기 해주세요.
            </p>
          )}
          {copied === "fail" && (
            <p className="text-center text-xs font-bold break-keep text-red-600">
              자동 복사가 안 되는 브라우저예요. 위 계좌번호를 길게 눌러 복사해
              주세요.
            </p>
          )}

          <a
            href={TOSS_SEND_URL}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0064FF] py-3.5 text-base font-black text-white transition active:scale-[0.98]"
          >
            <Send className="h-5 w-5" />
            토스로 바로 입금
          </a>
          <p className="text-center text-[11px] font-medium text-slate-400">
            토스 바로 입금은 토스 앱이 설치된 휴대폰에서만 동작합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
