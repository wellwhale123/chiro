import { Mail, MapPin } from "lucide-react";

export function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-white text-slate-800 selection:bg-blue-200 selection:text-blue-900">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* 상단 블루 그라데이션 밴드 - 심플하되 포인트가 되도록 */}
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-gradient-to-b from-blue-100/75 via-blue-50/55 to-transparent" />

        {/* 은은하게 번지는 블루 톤 그라데이션 블롭 */}
        <div className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-blue-300/45 blur-[110px]" />
        <div className="absolute top-1/4 -right-48 h-[34rem] w-[34rem] rounded-full bg-[#1E3A8A]/[0.16] blur-[110px]" />
        <div className="absolute bottom-0 left-1/4 h-[30rem] w-[30rem] rounded-full bg-sky-300/40 blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 h-[20rem] w-[20rem] rounded-full bg-blue-200/55 blur-[90px]" />

        {/* 옅은 도트 텍스처로 밋밋하지 않게 */}
        <div
          className="absolute inset-0 opacity-[0.18]"
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
            <a
              href="https://www.instagram.com/cau_chiro"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-[#1E3A8A]"
            >
              <InstagramIcon className="h-4 w-4 shrink-0 text-slate-400" />
              @cau_chiro
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

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
    </svg>
  );
}
