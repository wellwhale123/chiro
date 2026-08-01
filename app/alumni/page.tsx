import { ExternalLink } from "lucide-react";
import { getAlumni, type Alumnus } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";

export const revalidate = 60;

export default async function AlumniPage() {
  const alumni = await getAlumni();

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-5xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader num="0" title="Alumni" desc="CHIRO를 거쳐간 졸업생들입니다." />

        {alumni.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center text-sm font-medium text-slate-400">
            아직 등록된 졸업생 정보가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {alumni.map((person) => (
              <AlumnusCard key={person.id} person={person} />
            ))}
          </div>
        )}

        <div className="mt-16 rounded-2xl border border-blue-100 bg-blue-50/60 p-8 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            CHIRO는 졸업생 여러분의 등록을 환영합니다.
            <br />
            등록을 원하시는 분은{" "}
            <a
              href="mailto:brightyes7@cau.ac.kr"
              className="font-bold text-[#1E3A8A] underline underline-offset-2 hover:text-blue-800"
            >
              brightyes7@cau.ac.kr
            </a>
            로 등록하실 정보와 졸업 증명서를 보내주시기 바랍니다.
          </p>
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}

function AlumnusCard({ person }: { person: Alumnus }) {
  return (
    <div className="flex flex-col rounded-[2rem] border border-white bg-white/60 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-transform hover:-translate-y-1">
      <div className="flex items-center gap-2">
        <p className="text-lg font-black text-slate-800">{person.name}</p>
        {person.graduationYear && (
          <span className="rounded-md bg-[#1E3A8A]/10 px-2 py-0.5 text-[10px] font-black text-[#1E3A8A]">
            {person.graduationYear}년 졸업
          </span>
        )}
      </div>

      {(person.major || person.current || person.email || person.url) && (
        <div className="mt-5 flex flex-col gap-2">
          {person.major && <InfoRow label="학과" value={person.major} />}
          {person.current && <InfoRow label="현재" value={person.current} />}
          {person.email && <InfoRow label="이메일" value={person.email} href={`mailto:${person.email}`} />}
          {person.url && <InfoRow label="링크" href={person.url} />}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value?: string; href?: string }) {
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
