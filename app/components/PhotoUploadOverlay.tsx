"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function PhotoUploadOverlay({ pageId }: { pageId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("pageId", pageId);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "업로드에 실패했습니다.");
        setUploading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-slate-900/0 opacity-0 transition-all duration-200 hover:bg-slate-900/50 hover:opacity-100">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-xl bg-white px-4 py-2 text-xs font-bold tracking-wide text-slate-800 shadow-lg transition hover:bg-slate-50 disabled:opacity-50"
      >
        {uploading ? "업로드 중..." : "사진 업로드"}
      </button>
      {error && (
        <p className="absolute bottom-2 left-2 right-2 text-center text-[11px] font-bold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
