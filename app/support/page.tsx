import type { Metadata } from "next";
import { Building2, Heart, Mail } from "lucide-react";
import { getSponsors, groupSponsors } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { SponsorSections } from "../components/SponsorCard";
import { CopyButton } from "../components/CopyButton";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "후원 - CHIRO",
  description: "CHIRO를 후원해주시는 기업과 후원 방법을 안내합니다.",
  alternates: { canonical: "/support" },
};

// 후원 계좌 정보. 비워두면 계좌 안내 카드는 표시되지 않고 문의 안내만 보입니다.
const BANK_NAME = "";
const ACCOUNT_NUMBER = "";
const ACCOUNT_HOLDER = "";

const CONTACT_EMAIL = "brightyes7@cau.ac.kr";

// 후원금 사용처 (자유롭게 수정하세요)
const USAGES = [
  { title: "대회 출전", desc: "국내외 로봇 대회 참가비, 운송비, 출장 경비" },
  { title: "부품·장비", desc: "모터, 센서, 보드 등 프로젝트 부품과 3D 프린터 소모품" },
  { title: "교육·네트워킹", desc: "신입 부원 교육과 스터디, 기업 견학 등 현업과의 교류" },
];

export default async function SupportPage() {
  const sponsors = await getSponsors().catch((error) => {
    console.error("후원 기업 조회 실패 (후원 페이지는 정상 표시):", error);
    return [];
  });
  const sections = groupSponsors(sponsors);
  const hasAccount = Boolean(BANK_NAME && ACCOUNT_NUMBER);

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-6xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader
          num="0"
          title="Sponsors"
          desc="CHIRO와 함께해주시는 후원 기업입니다. 보내주신 후원은 학생들의 연구와 도전에 소중히 쓰입니다."
        />

        {/* 후원 기업: 등급이 높은 순서대로 가장 먼저, 크게 노출 */}
        {sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center text-sm font-medium text-slate-400">
            CHIRO의 첫 번째 후원 기업이 되어주세요.
          </div>
        ) : (
          <SponsorSections sections={sections} />
        )}

        {/* 후원금 사용처 */}
        <div className="mt-32">
          <SectionHeader num="1" title="Where it goes" desc="후원금은 이렇게 사용됩니다." />
          <div className="grid gap-6 sm:grid-cols-3">
            {USAGES.map((usage, i) => (
              <div
                key={usage.title}
                className="rounded-[2rem] border border-white bg-white/60 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl"
              >
                <p className="mb-4 text-4xl font-black text-slate-200" style={{ fontFamily: "var(--font-chakra)" }}>
                  0{i + 1}
                </p>
                <p className="text-lg font-bold text-slate-700">{usage.title}</p>
                <p className="mt-2 text-sm text-slate-500">{usage.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 후원 방법 */}
        <div className="mt-32">
          <SectionHeader num="2" title="Support us" desc="기업 후원과 개인 후원 모두 환영합니다." />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col rounded-[2rem] border border-white bg-white/60 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1E3A8A]">
                <Building2 className="h-5 w-5" />
              </div>
              <p className="mt-5 text-xl font-black text-slate-800">기업 후원 · 협찬 문의</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                후원 기업은 이 페이지와 홈 화면에 로고가 노출되며, 대회 출전 시 유니폼·로봇 부착 등
                협의된 방식으로 홍보해 드립니다. 아래 메일로 연락 주시면 제안서를 보내드립니다.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[CHIRO] 기업 후원 문의")}`}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
              >
                <Mail className="h-4 w-4" />
                {CONTACT_EMAIL}
              </a>
            </div>

            <div className="flex flex-col rounded-[2rem] border border-white bg-white/60 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1E3A8A]">
                <Heart className="h-5 w-5" />
              </div>
              <p className="mt-5 text-xl font-black text-slate-800">개인 후원</p>
              {hasAccount ? (
                <>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    아래 계좌로 보내주세요. 입금자명에 성함을 적어주시면 감사 인사를 전해드립니다.
                  </p>
                  <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                        {BANK_NAME} · 예금주 {ACCOUNT_HOLDER}
                      </p>
                      <p className="mt-1 truncate text-base font-bold text-slate-700">{ACCOUNT_NUMBER}</p>
                    </div>
                    <CopyButton text={`${BANK_NAME} ${ACCOUNT_NUMBER}`} />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  개인 후원을 원하시는 분은 {CONTACT_EMAIL}로 연락 주시면 후원 방법을 안내해 드립니다.
                </p>
              )}
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            CHIRO는 지정기부금단체가 아니어서 기부금 영수증은 발급되지 않습니다.
          </p>
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
