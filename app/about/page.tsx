import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";

export default function AboutPage() {
  const options = [
    {
      href: "/about/club",
      title: "동아리 소개",
      desc: "CHIRO가 어떤 동아리인지, 어떤 활동을 하는지 소개합니다.",
    },
    {
      href: "/about/officers",
      title: "운영진 소개",
      desc: "CHIRO를 이끌어가는 임원진을 소개합니다.",
    },
    {
      href: "/about/directions",
      title: "찾아오는 길",
      desc: "동아리방 위치와 상세 주소를 안내합니다.",
    },
  ];

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-4xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader num="0" title="About" desc="CHIRO에 대해 궁금한 점을 골라보세요." />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((opt) => (
            <Link
              key={opt.href}
              href={opt.href}
              className="group flex flex-col justify-between rounded-[2rem] border border-white bg-white/60 p-10 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-slate-200/50"
            >
              <div>
                <p className="text-2xl font-black text-slate-800">{opt.title}</p>
                <p className="mt-3 text-sm text-slate-500">{opt.desc}</p>
              </div>
              <div className="mt-10 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1E3A8A] transition-transform group-hover:translate-x-2">
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
