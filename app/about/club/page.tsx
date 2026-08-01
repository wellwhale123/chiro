import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageBackground, SiteFooter } from "../../components/PageBackground";

export default function ClubIntroPage() {
  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-3xl px-6 pb-32 pt-20 lg:pt-32">
        <Link
          href="/about"
          className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#1E3A8A]"
        >
          <ChevronLeft className="h-4 w-4" />
          소개로 돌아가기
        </Link>

        <p className="mb-3 text-sm font-bold tracking-[0.3em] text-slate-500">중앙대학교 로봇동아리</p>
        <h1
          className="text-5xl font-black tracking-tighter text-slate-800 md:text-6xl"
          style={{ fontFamily: "var(--font-chakra)" }}
        >
          CHI<span className="text-[#1E3A8A]">RO</span>
        </h1>
        <p className="mt-2 text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">
          Human Intelligence Robot
        </p>

        <div className="mt-12 flex flex-col gap-6 text-base leading-relaxed text-slate-600">
          <p>
            CHIRO는 로봇과 사람을 잇는 기술을 함께 고민하는 중앙대학교 로봇 동아리입니다.
            전공에 관계없이 손으로 직접 만들고, 부딪히고, 배우며 성장하는 것을 목표로 합니다.
          </p>
          <p>
            자율주행, 로봇 팔, 컴퓨터 비전 등 다양한 분야의 프로젝트를 함께 진행하며,
            매년 여러 대회에 참가하고 정기적인 스터디와 세미나를 운영하고 있습니다.
          </p>
          <p>
            자세한 활동 내역과 수상 기록은 홈페이지의 활동/수상 페이지에서 확인하실 수 있습니다.
          </p>
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
