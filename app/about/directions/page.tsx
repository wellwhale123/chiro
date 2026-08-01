import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";
import { PageBackground, SiteFooter } from "../../components/PageBackground";

const LAT = 37.5035565;
const LNG = 126.957605;

export default function DirectionsPage() {
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

        <p className="mb-3 text-sm font-bold tracking-[0.3em] text-slate-500">동아리방 위치</p>
        <h1 className="text-4xl font-black tracking-tight text-slate-800 md:text-5xl">
          찾아오는 길
        </h1>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-white shadow-[0_20px_40px_rgba(0,0,0,0.06)]">
          <iframe
            title="중앙대학교 봅스트홀 위치 지도"
            src={`https://maps.google.com/maps?q=${LAT},${LNG}(중앙대학교 봅스트홀)&z=17&output=embed`}
            width="100%"
            height="420"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white bg-white/60 p-6 shadow-sm backdrop-blur-xl">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#1E3A8A]" />
          <div>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">상세 주소</p>
            <p className="mt-1 text-base font-bold text-slate-700">
              서울특별시 동작구 흑석로 84 (흑석동 221) 207관 201호
            </p>
            <p className="mt-1 text-sm text-slate-500">중앙대학교 서울캠퍼스 봅스트홀</p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
