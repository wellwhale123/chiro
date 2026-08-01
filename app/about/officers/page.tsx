import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { getOfficers, groupOfficers, type Officer } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../../components/PageBackground";
import { SectionHeader } from "../../components/SectionHeader";

export const revalidate = 60;

export default async function OfficersPage() {
  const officers = await getOfficers();
  const sections = groupOfficers(officers);

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-5xl px-6 pb-32 pt-20 lg:pt-32">
        <Link
          href="/about"
          className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#1E3A8A]"
        >
          <ChevronLeft className="h-4 w-4" />
          소개로 돌아가기
        </Link>

        <SectionHeader num="0" title="Officers" desc="CHIRO를 이끌어가는 임원진입니다." />

        {sections.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center text-sm font-medium text-slate-400">
            아직 등록된 임원진 정보가 없습니다.
          </div>
        )}

        <div className="flex flex-col">
          {sections.map((section, i) => (
            <div
              key={section.label}
              className={i > 0 ? "mt-14 border-t-4 border-slate-200 pt-14" : ""}
            >
              <p className="mb-6 text-sm font-black tracking-widest text-[#1E3A8A] uppercase">
                {section.label}
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {section.members.map((officer) => (
                  <OfficerCard key={officer.id} officer={officer} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}

function OfficerCard({ officer }: { officer: Officer }) {
  const showPosition = officer.position === "부장";

  return (
    <div className="flex flex-col rounded-[2rem] border border-white bg-white/60 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-transform hover:-translate-y-1">
      <div className="flex items-center gap-2">
        <p className="text-lg font-black text-slate-800">{officer.name}</p>
        {showPosition && (
          <span className="rounded-md bg-[#1E3A8A]/10 px-2 py-0.5 text-[10px] font-black text-[#1E3A8A]">
            부장
          </span>
        )}
      </div>

      {(officer.major || officer.contact || officer.github) && (
        <div className="mt-5 flex flex-col gap-2">
          {officer.major && <InfoRow label="학과" value={officer.major} />}
          {officer.contact && (
            <InfoRow label="연락처" value={officer.contact} href={`mailto:${officer.contact}`} />
          )}
          {officer.github && <InfoRow label="GitHub" href={officer.github} />}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
}: {
  label: string;
  value?: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-[10px] font-black tracking-widest text-slate-400 uppercase">
          {label}
        </span>
        {value && <span className="truncate text-xs font-bold text-slate-600">{value}</span>}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#1E3A8A] shadow-sm transition hover:bg-blue-50"
        >
          바로가기
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
