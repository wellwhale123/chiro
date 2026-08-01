import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin";
import { notion } from "@/lib/notion";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_FILE_COUNT = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const pageId = form.get("pageId");
  const propertyName = (form.get("propertyName") as string) || "사진";

  if (files.length === 0 || typeof pageId !== "string" || !pageId) {
    return NextResponse.json({ error: "파일 또는 대상 정보가 없습니다." }, { status: 400 });
  }

  if (files.length > MAX_FILE_COUNT) {
    return NextResponse.json(
      { error: `사진은 최대 ${MAX_FILE_COUNT}장까지 한 번에 업로드할 수 있습니다.` },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "jpg, png, webp, gif 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 하나당 크기는 8MB를 넘을 수 없습니다." }, { status: 400 });
    }
  }

  try {
    // 1~2. 파일마다 Notion 업로드 슬롯 생성 후 바이트 전송
    const uploadedFiles = [];
    for (const file of files) {
      const fileUpload = await notion.fileUploads.create({
        mode: "single_part",
        filename: file.name,
        content_type: file.type,
      });

      await notion.fileUploads.send({
        file_upload_id: fileUpload.id,
        file: {
          filename: file.name,
          data: file,
        },
      });

      uploadedFiles.push({
        type: "file_upload" as const,
        file_upload: { id: fileUpload.id },
        name: file.name,
      });
    }

    // 3. 대상 페이지의 사진 속성을 새로 업로드한 사진들로 교체
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [propertyName]: {
          type: "files",
          files: uploadedFiles,
        },
      },
    });

    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notion 업로드 실패:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: `업로드 중 오류가 발생했습니다.${detail ? ` (${detail})` : ""}` },
      { status: 500 }
    );
  }
}
