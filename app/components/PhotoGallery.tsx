"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function PhotoGallery({ photoUrls, title }: { photoUrls: string[]; title: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photoUrls.length === 0) return null;

  return (
    <>
      <div
        className={`mt-10 grid gap-3 ${
          photoUrls.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {photoUrls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="cursor-zoom-in overflow-hidden rounded-2xl border border-white shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-transform hover:-translate-y-0.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${title} 사진 ${i + 1}`}
              className={photoUrls.length === 1 ? "w-full object-cover" : "aspect-[4/3] w-full object-cover"}
            />
          </button>
        ))}
      </div>

      {openIndex !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <Lightbox
            urls={photoUrls}
            index={openIndex}
            title={title}
            onClose={() => setOpenIndex(null)}
            onChangeIndex={setOpenIndex}
          />,
          document.body
        )}
    </>
  );
}

function Lightbox({
  urls,
  index,
  title,
  onClose,
  onChangeIndex,
}: {
  urls: string[];
  index: number;
  title: string;
  onClose: () => void;
  onChangeIndex: (i: number) => void;
}) {
  const goPrev = () => onChangeIndex((index - 1 + urls.length) % urls.length);
  const goNext = () => onChangeIndex((index + 1) % urls.length);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/85 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="이전 사진"
            className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="다음 사진"
            className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest text-white/70">
            {index + 1} / {urls.length}
          </p>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt={`${title} 사진 ${index + 1}`}
        className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
