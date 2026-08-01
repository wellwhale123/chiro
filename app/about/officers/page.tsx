import Link from "next/link";
import { ChevronLeft, ExternalLink, Mail } from "lucide-react";
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
            <div key={section.label} className={i > 0 ? "mt-12 border-t border-slate-200/70 pt-12" : ""}>
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
  return (
    <div className="flex flex-col items-center rounded-[2rem] border border-white bg-white/60 p-8 text-center shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-transform hover:-translate-y-1">
      <div className="mb-6 h-24 w-24 overflow-hidden rounded-full bg-gradient-to-tr from-slate-200 to-white shadow-inner">
        {officer.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={officer.photoUrl} alt={officer.name} className="h-full w-full object-cover" />
        )}
      </div>

      <p className="text-lg font-black text-slate-800">{officer.name}</p>
      {officer.position && <p className="mt-1 text-sm font-bold text-[#1E3A8A]">{officer.position}</p>}
      {officer.major && <p className="mt-3 text-xs font-medium text-slate-400">{officer.major}</p>}

      {(officer.github || officer.contact) && (
        <div className="mt-5 flex items-center gap-3">
          {officer.github && (
            <a
              href={officer.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label={`${officer.name} GitHub`}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {officer.contact && (
            <a
              href={`mailto:${officer.contact}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label={`${officer.name} 이메일`}
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
