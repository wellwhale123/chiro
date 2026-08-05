import { NextRequest, NextResponse } from "next/server";
import { createEmailOtp, isSchoolEmail } from "@/lib/otp";
import { sendMail } from "@/lib/mailer";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
  }
  if (!isSchoolEmail(email)) {
    return NextResponse.json({ error: "학교 이메일(@cau.ac.kr)만 사용할 수 있습니다." }, { status: 400 });
  }

  try {
    const { code, token } = createEmailOtp(email);

    await sendMail({
      to: email,
      subject: "[CHIRO] 개강총회 신청 인증코드",
      html: `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <p>안녕하세요, CHIRO 개강총회 신청 인증코드입니다.</p>
          <p style="font-size: 28px; font-weight: 800; letter-spacing: 4px;">${code}</p>
          <p style="color: #64748b; font-size: 13px;">이 코드는 10분간 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error("인증코드 발송 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `인증코드 발송에 실패했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
