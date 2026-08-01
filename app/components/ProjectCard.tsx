import Link from "next/link";
import type { NormalizedItem } from "@/lib/notion";
import { PhotoUploadOverlay } from "./PhotoUploadOverlay";
import { EditItemButton } from "./EditItemButton";

export function ProjectCard({
  project,
  isAdmin,
  href,
}: {
  project: NormalizedItem;
  isAdmin: boolean;
  href: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-slate-200/50">
      {isAdmin && (
        <EditItemButton
          dbKey="projects"
          pageId={project.id}
          initialValues={{
            title: project.title,
            startDate: project.startDate,
            endDate: project.endDate,
            tag: project.tag,
            detail: project.detail,
          }}
          existingPhotoUrl={project.photoUrl}
          className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-white bg-white/90 text-slate-500 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-[#1E3A8A]"
        />
      )}
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-slate-100 to-[#E2E8F0]">
          {project.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.photoUrl} alt={project.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-end p-6">
              <div className="h-full w-full rounded-xl bg-white/40 shadow-sm border border-white/50" />
            </div>
          )}
          {isAdmin && <PhotoUploadOverlay pageId={project.id} />}
        </div>
        <div className="p-8">
          {project.tag && (
            <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#1E3A8A] uppercase">{project.tag}</p>
          )}
          <p className="text-xl font-bold text-slate-800">{project.title}</p>
          {project.dateLabel && (
            <p className="mt-1 text-xs font-bold text-slate-400">{project.dateLabel}</p>
          )}
          {project.detail && (
            <p className="mt-2 text-sm text-slate-500 line-clamp-2">{project.detail}</p>
          )}
        </div>
      </Link>
    </div>
  );
}
