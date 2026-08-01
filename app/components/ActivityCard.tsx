import Link from "next/link";
import type { NormalizedItem } from "@/lib/notion";
import { EditItemButton } from "./EditItemButton";
import { SafeImage } from "./SafeImage";

export function ActivityCard({
  item,
  isAdmin,
  href,
}: {
  item: NormalizedItem;
  isAdmin: boolean;
  href: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-slate-200/50">
      {isAdmin && (
        <EditItemButton
          dbKey="activities"
          pageId={item.id}
          initialValues={{
            title: item.title,
            startDate: item.startDate,
            endDate: item.endDate,
            detail: item.detail,
          }}
          existingPhotoUrls={item.photoUrls}
          className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-white bg-white/90 text-slate-500 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-[#1E3A8A]"
        />
      )}
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-slate-100 to-[#E2E8F0]">
          {item.photoUrl ? (
            <SafeImage src={item.photoUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-end p-6">
              <div className="h-full w-full rounded-xl bg-white/40 shadow-sm border border-white/50" />
            </div>
          )}
        </div>
        <div className="p-6">
          <p className="text-lg font-bold text-slate-800">{item.title}</p>
          <p className="mt-1 text-sm font-bold text-[#1E3A8A]">{item.dateLabel}</p>
        </div>
      </Link>
    </div>
  );
}
