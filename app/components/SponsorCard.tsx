import { ArrowUpRight, Check } from "lucide-react";
import type { Sponsor, SponsorSection } from "@/lib/notion";
import { SafeImage } from "./SafeImage";

// 최상위 등급 기업이 한 곳일 때: 로고와 후원 내용을 가로로 넓게 보여주는 대표 카드
export function FeaturedSponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="grid overflow-hidden rounded-[2rem] border border-white bg-white/60 shadow-[0_20px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex items-center justify-center bg-white px-10 py-14 md:py-20">
        {sponsor.logoUrl ? (
          <SafeImage
            src={sponsor.logoUrl}
            alt={`${sponsor.name} 로고`}
            className="max-h-32 w-full max-w-xs object-contain"
          />
        ) : (
          <span className="text-3xl font-black text-slate-700">{sponsor.name}</span>
        )}
      </div>

      <div className="flex flex-col justify-center p-8 md:p-12">
        <p className="text-xs font-black tracking-[0.3em] text-[#1E3A8A] uppercase">{sponsor.tier || "메인"} 후원사</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-slate-800">{sponsor.name}</p>
        {sponsor.description && <p className="mt-3 text-sm leading-relaxed text-slate-500">{sponsor.description}</p>}

        {sponsor.benefits.length > 0 && (
          <ul className="mt-8 flex flex-col gap-3">
            {sponsor.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-sm font-bold text-slate-700">{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        {sponsor.url && (
          <a
            href={sponsor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-[#1E3A8A] transition hover:text-blue-800"
          >
            홈페이지 방문
            <ArrowUpRight className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

// 등급이 높을수록(rank가 작을수록) 카드와 로고를 크게 보여줍니다.
export function SponsorCard({ sponsor, rank }: { sponsor: Sponsor; rank: number }) {
  const featured = rank === 0;

  const content = (
    <>
      <div
        className={`flex w-full items-center justify-center rounded-2xl bg-white ${
          featured ? "h-36 p-6" : rank === 1 ? "h-28 p-5" : "h-20 p-4"
        }`}
      >
        {sponsor.logoUrl ? (
          <SafeImage src={sponsor.logoUrl} alt={`${sponsor.name} 로고`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={`font-black text-slate-700 ${featured ? "text-2xl" : "text-lg"}`}>{sponsor.name}</span>
        )}
      </div>
      {sponsor.logoUrl && (
        <p className={`mt-4 font-black text-slate-800 ${featured ? "text-lg" : "text-sm"}`}>{sponsor.name}</p>
      )}
      {sponsor.description && featured && (
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{sponsor.description}</p>
      )}
      {sponsor.benefits.length > 0 && featured && (
        <ul className="mt-4 flex flex-col gap-1.5 text-left">
          {sponsor.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-xs font-bold text-slate-600">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1E3A8A]" strokeWidth={3} />
              {benefit}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const className = `flex flex-col items-center rounded-[2rem] border border-white bg-white/60 text-center shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-transform hover:-translate-y-1 ${
    featured ? "p-8" : "p-6"
  }`;

  if (sponsor.url) {
    return (
      <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}

// 등급별 후원 기업 목록. 최상위 등급이 한 곳이면 대표 카드로, 나머지는 등급이 높을수록 크게 보여줍니다.
export function SponsorSections({ sections }: { sections: SponsorSection[] }) {
  return (
    <div className="flex flex-col gap-14">
      {sections.map((section, rank) => (
        <div key={section.tier}>
          {rank === 0 && section.sponsors.length === 1 ? (
            <FeaturedSponsorCard sponsor={section.sponsors[0]} />
          ) : (
            <>
              <p className="mb-5 text-center text-xs font-black tracking-[0.3em] text-[#1E3A8A] uppercase sm:text-left">
                {section.tier} 후원
              </p>
              <div
                className={`grid gap-6 ${
                  rank === 0
                    ? "grid-cols-1 sm:grid-cols-2"
                    : rank === 1
                      ? "grid-cols-2 lg:grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                }`}
              >
                {section.sponsors.map((sponsor) => (
                  <SponsorCard key={sponsor.id} sponsor={sponsor} rank={Math.min(rank, 2)} />
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
