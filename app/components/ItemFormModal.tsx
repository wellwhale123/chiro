"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DB_FIELDS, DB_LABELS, type DbKey } from "@/lib/dbFields";
import { compressImages } from "@/lib/imageCompression";

export type ItemFormValues = {
  title: string;
  date: string;
  startDate: string;
  endDate: string;
  detail: string;
  tag: string;
};

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
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const MAX_PHOTOS = 5;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > MAX_PHOTOS) {
      setError(`사진은 최대 ${MAX_PHOTOS}장까지 선택할 수 있습니다.`);
      setPhotoFiles(selected.slice(0, MAX_PHOTOS));
      return;
    }
    setError(null);
    setCompressing(true);
    try {
      const compressed = await compressImages(selected);
      setPhotoFiles(compressed);
    } finally {
      setCompressing(false);
    }
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

      if (photoFiles.length > 0 && targetPageId) {
        const formData = new FormData();
        photoFiles.forEach((f) => formData.append("file", f));
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

          {fields.includes("photo") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500">
                사진 (최대 {MAX_PHOTOS}장){mode === "edit" && " — 새로 선택하면 기존 사진 전체를 교체합니다"}
              </span>
              {mode === "edit" && existingPhotoUrls && existingPhotoUrls.length > 0 && (
                <div className="mb-1 flex flex-wrap gap-2">
                  {existingPhotoUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt={`현재 사진 ${i + 1}`}
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              )}
              <input
                type="file"
                multiple
                disabled={compressing}
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                onChange={handlePhotoChange}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-bold disabled:opacity-50"
              />
              {compressing && (
                <p className="text-xs font-medium text-slate-400">사진 용량 줄이는 중...</p>
              )}
              {!compressing && photoFiles.length > 0 && (
                <p className="text-xs font-medium text-slate-400">{photoFiles.length}장 선택됨</p>
              )}
            </label>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

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
