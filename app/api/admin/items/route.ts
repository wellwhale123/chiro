import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin";
import {
  createNotionItem,
  updateNotionItem,
  deleteNotionItem,
  DATABASE_IDS,
  type DatabaseKey,
} from "@/lib/notion";

function isDatabaseKey(value: unknown): value is DatabaseKey {
  return typeof value === "string" && value in DATABASE_IDS;
}

export async function POST(request: NextRequest) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !isDatabaseKey(body.dbKey)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "제목을 입력해 주세요." }, { status: 400 });
  }

  try {
    const pageId = await createNotionItem(body.dbKey, {
      title,
      date: typeof body.date === "string" ? body.date : undefined,
      startDate: typeof body.startDate === "string" ? body.startDate : undefined,
      endDate: typeof body.endDate === "string" ? body.endDate : undefined,
      detail: typeof body.detail === "string" ? body.detail : undefined,
      tag: typeof body.tag === "string" ? body.tag : undefined,
    });

    revalidatePath("/");

    return NextResponse.json({ success: true, pageId });
  } catch (error) {
    console.error("Notion 항목 생성 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `생성 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !isDatabaseKey(body.dbKey) || typeof body.pageId !== "string" || !body.pageId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "제목을 입력해 주세요." }, { status: 400 });
  }

  try {
    await updateNotionItem(body.dbKey, body.pageId, {
      title,
      date: typeof body.date === "string" ? body.date : undefined,
      startDate: typeof body.startDate === "string" ? body.startDate : undefined,
      endDate: typeof body.endDate === "string" ? body.endDate : undefined,
      detail: typeof body.detail === "string" ? body.detail : undefined,
      tag: typeof body.tag === "string" ? body.tag : undefined,
    });

    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notion 항목 수정 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `수정 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.pageId !== "string" || !body.pageId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    await deleteNotionItem(body.pageId);
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notion 항목 삭제 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `삭제 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
