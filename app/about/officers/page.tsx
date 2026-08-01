import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageBackground, SiteFooter } from "../../components/PageBackground";
import { SectionHeader } from "../../components/SectionHeader";

export default function OfficersPage() {
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

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center text-sm font-medium text-slate-400">
          아직 등록된 임원진 정보가 없습니다. 운영진 소개 내용을 채워 넣고 싶으시면 알려주세요 — 활동/수상 페이지처럼 Notion과 연동해 사진과 소개를 직접 관리하실 수 있게 만들어 드릴 수 있습니다.
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
