import Link from "next/link";
import type { Sponsor } from "@/lib/notion";
import { SafeImage } from "./SafeImage";

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

// 홈 화면 상단에 들어가는 후원 기업 로고 띠
export function SponsorStrip({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <section className="mx-auto w-full max-w-7xl px-6">
      <div className="flex flex-col items-center gap-6 rounded-[2rem] border border-white bg-white/60 px-8 py-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl md:flex-row md:gap-10">
        <Link
          href="/support"
          className="shrink-0 text-xs font-black tracking-[0.25em] text-[#1E3A8A] uppercase transition hover:text-blue-800"
          style={{ fontFamily: "var(--font-chakra)" }}
        >
          Sponsored by
        </Link>
        <div className="flex flex-1 flex-wrap items-center justify-center gap-x-10 gap-y-6 md:justify-start">
          {sponsors.map((sponsor) => {
            const logo = sponsor.logoUrl ? (
              <SafeImage src={sponsor.logoUrl} alt={`${sponsor.name} 로고`} className="h-10 w-auto max-w-[9rem] object-contain" />
            ) : (
              <span className="text-base font-black text-slate-600">{sponsor.name}</span>
            );
            return sponsor.url ? (
              <a
                key={sponsor.id}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                title={sponsor.name}
                className="opacity-80 transition hover:opacity-100"
              >
                {logo}
              </a>
            ) : (
              <span key={sponsor.id} title={sponsor.name} className="opacity-80">
                {logo}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
