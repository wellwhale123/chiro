import { Mail, MapPin } from "lucide-react";

export function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-white text-slate-800 selection:bg-blue-200 selection:text-blue-900">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* 은은하게 번지는 블루 톤 그라데이션 (심플 + 세련된 느낌의 포인트) */}
        <div className="absolute -top-48 -left-48 h-[36rem] w-[36rem] rounded-full bg-blue-100/70 blur-[130px]" />
        <div className="absolute top-1/4 -right-56 h-[32rem] w-[32rem] rounded-full bg-blue-200/50 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-sky-100/60 blur-[110px]" />

        {/* 아주 옅은 도트 텍스처로 밋밋하지 않게 */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(circle at center, #94A3B8 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/50 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-2xl font-black tracking-[0.15em] text-slate-800 uppercase" style={{ fontFamily: "var(--font-chakra)" }}>
              CHI<span className="text-[#1E3A8A]">RO</span>
            </p>
            <p className="mt-2 text-xs font-bold tracking-[0.1em] text-slate-500 uppercase">
              Chung-Ang University Robotics Club
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              사람과 기술을 잇는 로봇을 만듭니다.
            </p>
          </div>

          <div>
            <p className="mb-4 text-xs font-black tracking-[0.2em] text-[#1E3A8A] uppercase">Contact</p>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">문의 및 협업 요청</p>
            <a
              href="mailto:brightyes7@cau.ac.kr"
              className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-[#1E3A8A]"
            >
              <Mail className="h-4 w-4 text-slate-400" />
              brightyes7@cau.ac.kr
            </a>
          </div>

          <div>
            <p className="mb-4 text-xs font-black tracking-[0.2em] text-[#1E3A8A] uppercase">Location</p>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">동아리방</p>
            <p className="mt-2 flex items-start gap-2 text-sm font-bold text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              중앙대학교 서울캠퍼스 봅스트홀 207관 201호
            </p>
          </div>
        </div>

        <div className="mt-14 border-t border-slate-200/70 pt-6 text-center">
          <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
            © {new Date().getFullYear()} CHIRO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
