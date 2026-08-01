import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { NormalizedItem } from "@/lib/notion";
import { PhotoUploadOverlay } from "./PhotoUploadOverlay";
import { EditItemButton } from "./EditItemButton";

export function ActivityRow({
  item,
  isAdmin,
  dbKey,
  href,
}: {
  item: NormalizedItem;
  isAdmin: boolean;
  dbKey: "activities" | "awards";
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-6 rounded-2xl border border-white bg-white/50 p-6 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-md"
    >
      <div className="flex min-w-0 items-center gap-6">
        <div className="flex w-40 shrink-0 flex-col text-left" style={{ fontFamily: "var(--font-chakra)" }}>
          {item.startDate && item.endDate && item.startDate !== item.endDate ? (
            <>
              <span className="whitespace-nowrap text-sm font-black leading-tight text-slate-400 transition-colors group-hover:text-[#1E3A8A]">
                {item.startDateLabel}
              </span>
              <span className="whitespace-nowrap text-sm font-black leading-tight text-slate-300 transition-colors group-hover:text-[#1E3A8A]/70">
                ~ {item.endDateLabel}
              </span>
            </>
          ) : (
            <span className="whitespace-nowrap text-sm font-black text-slate-300 transition-colors group-hover:text-[#1E3A8A]">
              {item.dateLabel}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-700">{item.title}</p>
          {item.detail && <p className="mt-1 truncate text-sm text-slate-500">{item.detail}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {isAdmin && (
          <EditItemButton
            dbKey={dbKey}
            pageId={item.id}
            initialValues={{
              title: item.title,
              date: item.date,
              startDate: item.startDate,
              endDate: item.endDate,
              detail: item.detail,
            }}
            existingPhotoUrl={item.photoUrl}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-[#1E3A8A]"
          />
        )}
        <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-blue-50">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <ArrowRight className="h-4 w-4 text-[#1E3A8A] transition-transform group-hover:translate-x-1" />
          )}
          {isAdmin && <PhotoUploadOverlay pageId={item.id} />}
        </div>
      </div>
    </Link>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-8 text-center text-sm font-medium text-slate-400">
      {label}
    </div>
  );
}
