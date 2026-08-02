import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin";
import { notion } from "@/lib/notion";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_FILE_COUNT = 5;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // 공지사항 첨부 서류용 (이미지 외 문서 형식)
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-hwp",
  "application/haansofthwp",
  "application/vnd.hancom.hwp",
  // 일부 브라우저/OS에서 hwp 등을 이렇게 보고하기도 함
  "application/octet-stream",
];

type OrderEntry = { type: "new"; index: number } | { type: "existing"; url: string };
type FilesPropertyEntry = { type: "file_upload"; file_upload: { id: string }; name: string };

function sanitizeFilename(originalName: string, index: number): string {
  const ext = originalName.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase() || ".jpg";
  return `photo-${Date.now()}-${index}${ext}`;
}

async function uploadNewFile(file: File, index: number): Promise<FilesPropertyEntry> {
  const filename = sanitizeFilename(file.name, index);
  const fileUpload = await notion.fileUploads.create({
    mode: "single_part",
    filename,
    content_type: file.type,
  });
  await notion.fileUploads.send({
    file_upload_id: fileUpload.id,
    file: { filename, data: file },
  });
  return { type: "file_upload", file_upload: { id: fileUpload.id }, name: filename };
}

// 기존에 이미 Notion에 있던 사진을 "유지"하려면, 순서가 섞인 새 배열을 통째로 다시 써야 하는
// Notion API 특성상 어쩔 수 없이 (현재 유효한 임시 URL로) 다시 내려받아 새 파일로 재업로드합니다.
async function reuploadExistingFile(url: string, index: number): Promise<FilesPropertyEntry> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("기존 사진을 불러오지 못했습니다.");
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = await res.arrayBuffer();
  const filename = sanitizeFilename(`existing-${index}.jpg`, index);
  const file = new File([buffer], filename, { type: contentType });

  const fileUpload = await notion.fileUploads.create({
    mode: "single_part",
    filename,
    content_type: contentType,
  });
  await notion.fileUploads.send({
    file_upload_id: fileUpload.id,
    file: { filename, data: file },
  });
  return { type: "file_upload", file_upload: { id: fileUpload.id }, name: filename };
}

export async function POST(request: NextRequest) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const pageId = form.get("pageId");
  const propertyName = (form.get("propertyName") as string) || "사진";

  if (typeof pageId !== "string" || !pageId) {
    return NextResponse.json({ error: "대상 정보가 없습니다." }, { status: 400 });
  }

  const orderRaw = form.get("order");

  try {
    let finalFiles: FilesPropertyEntry[];

    if (typeof orderRaw === "string") {
      // 새 방식: 삭제/추가/순서 변경이 섞인 최종 사진 목록을 그대로 반영
      let order: OrderEntry[];
      try {
        order = JSON.parse(orderRaw);
      } catch {
        return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
      }

      if (order.length > MAX_FILE_COUNT) {
        return NextResponse.json(
          { error: `사진은 최대 ${MAX_FILE_COUNT}장까지 가능합니다.` },
          { status: 400 }
        );
      }

      const newFiles = form.getAll("newFile").filter((f): f is File => f instanceof File);
      for (const file of newFiles) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          return NextResponse.json(
            { error: "jpg, png, webp, gif 파일만 업로드할 수 있습니다." },
            { status: 400 }
          );
        }
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: "파일 하나당 크기는 8MB를 넘을 수 없습니다." },
            { status: 400 }
          );
        }
      }

      finalFiles = await Promise.all(
        order.map((entry, i) => {
          if (entry.type === "new") {
            const file = newFiles[entry.index];
            if (!file) throw new Error("업로드할 파일을 찾을 수 없습니다.");
            return uploadNewFile(file, i);
          }
          return reuploadExistingFile(entry.url, i);
        })
      );
    } else {
      // 기존 방식(빠른 업로드 오버레이 등): 보낸 파일들로 전체 교체
      const files = form.getAll("file").filter((f): f is File => f instanceof File);
      if (files.length === 0) {
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
          return NextResponse.json(
            { error: "jpg, png, webp, gif 파일만 업로드할 수 있습니다." },
            { status: 400 }
          );
        }
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: "파일 하나당 크기는 8MB를 넘을 수 없습니다." },
            { status: 400 }
          );
        }
      }
      finalFiles = await Promise.all(files.map((f, i) => uploadNewFile(f, i)));
    }

    await notion.pages.update({
      page_id: pageId,
      properties: {
        [propertyName]: { type: "files", files: finalFiles },
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
