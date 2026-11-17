import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addAlumnus, ALUMNI_CAREERS, ALUMNI_MONTHS, type AlumnusInput } from "@/lib/notion";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 졸업생 본인 등록. 모든 항목은 선택이지만, 하나도 입력하지 않은 요청은 받지 않습니다.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const str = (key: string, max: number) => {
    const v = (body as Record<string, unknown>)[key];
    return typeof v === "string" ? v.trim().slice(0, max) : "";
  };

  const name = str("name", 30);
  const yearText = str("graduationYear", 4);
  const graduationMonth = str("graduationMonth", 3);
  const email = str("email", 100);
  const career = str("career", 5);
  const careerDetail = str("careerDetail", 100);

  const input: AlumnusInput = {};
  if (name) input.name = name;

  if (yearText) {
    const year = Number(yearText);
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > thisYear + 1) {
      return NextResponse.json({ error: "졸업연도를 다시 확인해 주세요." }, { status: 400 });
    }
    input.graduationYear = year;
  }
  if (graduationMonth) {
    if (!(ALUMNI_MONTHS as readonly string[]).includes(graduationMonth)) {
      return NextResponse.json({ error: "졸업 월을 다시 선택해 주세요." }, { status: 400 });
    }
    input.graduationMonth = graduationMonth;
  }
  if (email) {
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "이메일 주소를 다시 확인해 주세요." }, { status: 400 });
    }
    input.email = email;
  }
  if (career) {
    if (!(ALUMNI_CAREERS as readonly string[]).includes(career)) {
      return NextResponse.json({ error: "진학 분야를 다시 선택해 주세요." }, { status: 400 });
    }
    input.career = career;
    if (careerDetail) input.careerDetail = careerDetail;
  }

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "한 가지 이상 입력해 주세요." }, { status: 400 });
  }

  try {
    await addAlumnus(input);
    revalidatePath("/alumni");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("졸업생 등록 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `등록 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
