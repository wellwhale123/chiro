import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { NormalizedItem } from "@/lib/notion";
import { PhotoGallery } from "./PhotoGallery";

export function DetailView({
  item,
  basePath,
  prevId,
  nextId,
  backHref,
  backLabel,
}: {
  item: NormalizedItem;
  basePath: string;
  prevId: string | null;
  nextId: string | null;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 lg:py-32">
      {backHref && (
        <Link
          href={backHref}
          className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#1E3A8A]"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel ?? "돌아가기"}
        </Link>
      )}

      <div>
        {item.tag && (
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#1E3A8A] uppercase">{item.tag}</p>
        )}
        <h1 className="text-4xl font-black tracking-tight text-slate-800 md:text-5xl">{item.title}</h1>
        {item.dateLabel && (
          <p className="mt-4 text-sm font-bold tracking-widest text-slate-400">{item.dateLabel}</p>
        )}
      </div>

      <PhotoGallery photoUrls={item.photoUrls} title={item.title} />

      {item.detail && (
        <p className="mt-10 whitespace-pre-wrap text-base leading-relaxed text-slate-600">
          {item.detail}
        </p>
      )}

      <div className="mt-16 flex items-center justify-between border-t border-slate-200/70 pt-8">
        {prevId ? (
          <Link
            href={`${basePath}/${prevId}`}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
          >
            <ChevronLeft className="h-4 w-4" /> 이전
          </Link>
        ) : (
          <span />
        )}
        {nextId ? (
          <Link
            href={`${basePath}/${nextId}`}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
          >
            다음 <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
