"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, FileText } from "lucide-react";
import { DB_FIELDS, DB_LABELS, type DbKey } from "@/lib/dbFields";
import { compressImages } from "@/lib/imageCompression";

export type ItemFormValues = {
  title: string;
  date: string;
  startDate: string;
  endDate: string;
  detail: string;
  tag: string;
  important: boolean;
  url: string;
};

// 파일이 이미지인지 판별 (미리보기를 <img>로 보여줄지, 문서 아이콘으로 보여줄지 결정)
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|svg)(\?.*)?$/i;
function isImageFile(item: PhotoItem): boolean {
  if (item.kind === "new") return item.file.type.startsWith("image/");
  return IMAGE_EXT_RE.test(item.url);
}
function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").pop() || "파일");
  } catch {
    return "파일";
  }
}

type PhotoItem =
  | { id: string; kind: "existing"; url: string }
  | { id: string; kind: "new"; file: File; previewUrl: string };

// 서버가 (요청 용량 초과 등으로) JSON이 아닌 응답을 줄 수도 있으므로 안전하게 파싱합니다.
async function safeJson(res: Response): Promise<{ error?: string; pageId?: string }> {
  try {
    return await res.json();
  } catch {
    if (res.status === 413) {
      return { error: "사진 용량이 너무 큽니다. 장수를 줄이거나 다시 시도해 주세요." };
    }
    return { error: `요청 처리에 실패했습니다. (status ${res.status})` };
  }
}

export function ItemFormModal({
  dbKey,
  mode,
  pageId,
  initialValues,
  existingPhotoUrls,
  onClose,
}: {
  dbKey: DbKey;
  mode: "create" | "edit";
  pageId?: string;
  initialValues?: Partial<ItemFormValues>;
  existingPhotoUrls?: string[];
  onClose: () => void;
}) {
  const fields = DB_FIELDS[dbKey];
  const [values, setValues] = useState<ItemFormValues>({
    title: initialValues?.title ?? "",
    date: initialValues?.date ?? "",
    startDate: initialValues?.startDate ?? "",
    endDate: initialValues?.endDate ?? "",
    detail: initialValues?.detail ?? "",
    tag: initialValues?.tag ?? "",
    important: initialValues?.important ?? false,
    url: initialValues?.url ?? "",
  });
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>(() =>
    (existingPhotoUrls ?? []).map((url) => ({ id: url, kind: "existing" as const, url }))
  );
  const initialPhotoUrlsRef = useRef(existingPhotoUrls ?? []);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const MAX_PHOTOS = 5;
  const isFileField = dbKey === "notices"; // 공지사항은 사진뿐 아니라 서류(PDF 등)도 첨부 가능

  function photosChanged(): boolean {
    const initial = initialPhotoUrlsRef.current;
    if (photoItems.some((item) => item.kind === "new")) return true;
    if (photoItems.length !== initial.length) return true;
    return photoItems.some((item, i) => item.kind === "existing" && item.url !== initial[i]);
  }

  async function handleDelete() {
    if (!pageId) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "삭제에 실패했습니다.");

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    if (photoItems.length + selected.length > MAX_PHOTOS) {
      setError(`사진은 최대 ${MAX_PHOTOS}장까지 가능합니다. (현재 ${photoItems.length}장)`);
      e.target.value = "";
      return;
    }

    setError(null);
    setCompressing(true);
    try {
      const compressed = await compressImages(selected);
      const newItems: PhotoItem[] = compressed.map((file, i) => ({
        id: `new-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        kind: "new",
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setPhotoItems((items) => [...items, ...newItems]);
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  }

  function removePhoto(id: string) {
    setPhotoItems((items) => {
      const target = items.find((item) => item.id === id);
      if (target?.kind === "new") URL.revokeObjectURL(target.previewUrl);
      return items.filter((item) => item.id !== id);
    });
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    setPhotoItems((items) => {
      const next = [...items];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let targetPageId = pageId;

      if (mode === "create") {
        const res = await fetch("/api/admin/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dbKey, ...values }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "생성에 실패했습니다.");
        targetPageId = data.pageId;
      } else {
        const res = await fetch("/api/admin/items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dbKey, pageId, ...values }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "수정에 실패했습니다.");
      }

      if (targetPageId && photosChanged()) {
        const newFiles: File[] = [];
        const order = photoItems.map((item) => {
          if (item.kind === "existing") {
            return { type: "existing" as const, url: item.url };
          }
          const index = newFiles.length;
          newFiles.push(item.file);
          return { type: "new" as const, index };
        });

        const formData = new FormData();
        newFiles.forEach((f) => formData.append("newFile", f));
        formData.append("order", JSON.stringify(order));
        formData.append("pageId", targetPageId);

        const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
        const uploadData = await safeJson(uploadRes);
        if (!uploadRes.ok) throw new Error(uploadData.error || "사진 업로드에 실패했습니다.");
      }

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setSaving(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-6 py-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">
          {DB_LABELS[dbKey]}
        </p>
        <h2 className="mb-6 text-xl font-black text-slate-800">
          {mode === "create" ? "새 항목 추가" : "항목 수정"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fields.includes("title") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">제목</span>
              <input
                type="text"
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                autoFocus
              />
            </label>
          )}

          {fields.includes("important") && (
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={values.important}
                onChange={(e) => setValues((v) => ({ ...v, important: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
              />
              <span className="text-sm font-bold text-slate-700">중요공지로 표시</span>
            </label>
          )}

          {fields.includes("date") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">날짜</span>
              <input
                type="date"
                value={values.date}
                onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
              />
            </label>
          )}

          {(fields.includes("startDate") || fields.includes("endDate")) && (
            <div className="grid grid-cols-2 gap-3">
              {fields.includes("startDate") && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">시작일</span>
                  <input
                    type="date"
                    value={values.startDate}
                    onChange={(e) => setValues((v) => ({ ...v, startDate: e.target.value }))}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                  />
                </label>
              )}
              {fields.includes("endDate") && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500">종료일 (진행중이면 비워두세요)</span>
                  <input
                    type="date"
                    value={values.endDate}
                    onChange={(e) => setValues((v) => ({ ...v, endDate: e.target.value }))}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
                  />
                </label>
              )}
            </div>
          )}

          {fields.includes("tag") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">태그</span>
              <input
                type="text"
                value={values.tag}
                onChange={(e) => setValues((v) => ({ ...v, tag: e.target.value }))}
                placeholder="예: PID · Sensor Fusion"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
              />
            </label>
          )}

          {fields.includes("detail") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">상세 내용</span>
              <textarea
                value={values.detail}
                onChange={(e) => setValues((v) => ({ ...v, detail: e.target.value }))}
                rows={3}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
              />
            </label>
          )}

          {fields.includes("url") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">관련 링크 (선택)</span>
              <input
                type="url"
                value={values.url}
                onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
                placeholder="https://..."
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]"
              />
            </label>
          )}

          {fields.includes("photo") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">
                {isFileField ? `첨부파일 (사진/PDF/문서, 최대 ${MAX_PHOTOS}개)` : `사진 (최대 ${MAX_PHOTOS}장)`} — 순서를 드래그로 바꿀 수 있어요
              </span>

              {photoItems.length > 0 && (
                <div className="mb-1 flex flex-wrap gap-2">
                  {photoItems.map((item, i) => {
                    const isImage = isImageFile(item);
                    const name =
                      item.kind === "new" ? item.file.name : fileNameFromUrl(item.url);
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(i)}
                        onDragEnd={() => setDragIndex(null)}
                        className={`relative h-16 w-16 shrink-0 cursor-grab active:cursor-grabbing ${
                          dragIndex === i ? "opacity-40" : ""
                        }`}
                        title={name}
                      >
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.kind === "existing" ? item.url : item.previewUrl}
                            alt={`사진 ${i + 1}`}
                            className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                            <FileText className="h-5 w-5 text-slate-400" />
                            <span className="w-full truncate text-center text-[8px] font-medium text-slate-400">
                              {name}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(item.id)}
                          aria-label="파일 삭제"
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {photoItems.length < MAX_PHOTOS && (
                <input
                  type="file"
                  multiple
                  disabled={compressing}
                  accept={
                    isFileField
                      ? "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,.doc,.docx,.hwp,.hwpx"
                      : "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                  }
                  onChange={handlePhotoChange}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-bold disabled:opacity-50"
                />
              )}
              {compressing && (
                <p className="text-xs font-medium text-slate-400">사진 용량 줄이는 중...</p>
              )}
            </label>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          {mode === "edit" && (
            <div className="mt-2 border-t border-slate-100 pt-4">
              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="text-xs font-bold text-red-500 transition hover:text-red-700"
                >
                  이 항목 삭제
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3">
                  <p className="flex-1 text-xs font-bold text-red-700">정말 삭제하시겠어요? 되돌릴 수 없어요.</p>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-500 transition hover:bg-red-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "삭제 중..." : "삭제 확정"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || compressing}
              className="flex-1 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
