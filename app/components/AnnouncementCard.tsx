import { FileText, ExternalLink } from "lucide-react";
import type { NormalizedItem } from "@/lib/notion";
import { EditItemButton } from "./EditItemButton";
import { SafeImage } from "./SafeImage";

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|svg)(\?.*)?$/i;

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").pop() || "첨부파일");
  } catch {
    return "첨부파일";
  }
}

export function AnnouncementCard({
  item,
  isAdmin,
}: {
  item: NormalizedItem;
  isAdmin: boolean;
}) {
  const images = item.photoUrls.filter((url) => IMAGE_EXT_RE.test(url));
  const documents = item.photoUrls.filter((url) => !IMAGE_EXT_RE.test(url));

  return (
    <div
      className={`relative rounded-2xl border p-6 shadow-sm backdrop-blur-md transition-all sm:p-8 ${
        item.important
          ? "border-red-200 bg-red-50/60"
          : "border-white bg-white/50 hover:bg-white/80 hover:shadow-md"
      }`}
    >
      {isAdmin && (
        <EditItemButton
          dbKey="notices"
          pageId={item.id}
          initialValues={{
            title: item.title,
            date: item.date,
            detail: item.detail,
            important: item.important,
            url: item.url,
          }}
          existingPhotoUrls={item.photoUrls}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-[#1E3A8A]"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {item.important && (
          <span className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-black tracking-widest text-white">
            중요공지
          </span>
        )}
        <span className="text-xs font-bold text-[#1E3A8A]">{item.dateLabel}</span>
      </div>

      <p className="mt-2 pr-10 text-lg font-black text-slate-800">{item.title}</p>

      {item.detail && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
          {item.detail}
        </p>
      )}

      {images.length > 0 && (
        <div className={`mt-4 grid gap-2 ${images.length === 1 ? "grid-cols-1 max-w-sm" : "grid-cols-2 sm:grid-cols-3"}`}>
          {images.map((url) => (
            <div key={url} className="overflow-hidden rounded-xl border border-white shadow-sm">
              <SafeImage src={url} alt={item.title} className="aspect-[4/3] w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {(documents.length > 0 || item.url) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {documents.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
            >
              <FileText className="h-3.5 w-3.5" />
              {fileNameFromUrl(url)}
            </a>
          ))}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#1E3A8A] shadow-sm transition hover:bg-blue-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              관련 링크
            </a>
          )}
        </div>
      )}
    </div>
  );
}
