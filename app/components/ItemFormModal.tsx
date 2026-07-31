"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DB_FIELDS, DB_LABELS, type DbKey } from "@/lib/dbFields";

export type ItemFormValues = {
  title: string;
  date: string;
  detail: string;
  tag: string;
};

export function ItemFormModal({
  dbKey,
  mode,
  pageId,
  initialValues,
  existingPhotoUrl,
  onClose,
}: {
  dbKey: DbKey;
  mode: "create" | "edit";
  pageId?: string;
  initialValues?: Partial<ItemFormValues>;
  existingPhotoUrl?: string | null;
  onClose: () => void;
}) {
  const fields = DB_FIELDS[dbKey];
  const [values, setValues] = useState<ItemFormValues>({
    title: initialValues?.title ?? "",
    date: initialValues?.date ?? "",
    detail: initialValues?.detail ?? "",
    tag: initialValues?.tag ?? "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "생성에 실패했습니다.");
        targetPageId = data.pageId;
      } else {
        const res = await fetch("/api/admin/items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dbKey, pageId, ...values }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "수정에 실패했습니다.");
      }

      if (photoFile && targetPageId) {
        const formData = new FormData();
        formData.append("file", photoFile);
        formData.append("pageId", targetPageId);
        const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
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
                사진 {mode === "edit" && "(선택 시 기존 사진 교체)"}
              </span>
              {mode === "edit" && existingPhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={existingPhotoUrl}
                  alt="현재 사진"
                  className="mb-1 h-24 w-24 rounded-lg border border-slate-200 object-cover"
                />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-bold"
              />
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
              disabled={saving}
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
