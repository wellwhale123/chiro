import { Mail, MapPin } from "lucide-react";

const floatingTools = [
  {
    className: "left-[10%] top-[15%] w-20 md:w-32 opacity-80",
    bodyClassName: "rotate-[15deg] drop-shadow-[0_20px_30px_rgba(0,0,0,0.07)]",
    icon: <MalletIcon />,
  },
  {
    className: "right-[15%] top-[25%] w-24 md:w-40 opacity-90",
    bodyClassName: "-rotate-[20deg] drop-shadow-[0_25px_35px_rgba(0,0,0,0.08)]",
    icon: <WrenchIcon />,
  },
  {
    className: "left-[20%] top-[65%] w-16 md:w-24 opacity-70 hidden sm:block",
    bodyClassName: "rotate-[45deg] drop-shadow-[0_15px_25px_rgba(0,0,0,0.06)]",
    icon: <ScrewdriverIcon />,
  },
  {
    className: "right-[25%] top-[70%] w-20 md:w-28 opacity-60 hidden md:block",
    bodyClassName: "-rotate-[10deg] drop-shadow-[0_20px_30px_rgba(0,0,0,0.05)]",
    icon: <HexKeyIcon />,
  },
];

export function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#F4F6F9] text-slate-800 selection:bg-blue-200 selection:text-blue-900">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(circle at center, #CBD5E1 2px, transparent 2px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-32 left-0 right-0 h-4 bg-gradient-to-b from-[#E2E8F0] to-[#F1F5F9] shadow-[0_10px_20px_rgba(0,0,0,0.03)] border-y border-white" />
        {floatingTools.map((tool, index) => (
          <div key={index} className={`absolute ${tool.className}`}>
            <div className={`relative ${tool.bodyClassName}`}>{tool.icon}</div>
          </div>
        ))}
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/50 bg-[#F4F6F9]/80 backdrop-blur-md">
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

function MalletIcon() {
  return (
    <svg viewBox="0 0 120 160" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wood" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
        <linearGradient id="head" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
      </defs>
      <rect x="45" y="40" width="30" height="120" rx="15" fill="url(#wood)" />
      <rect x="10" y="20" width="100" height="45" rx="8" fill="url(#head)" />
      <rect x="15" y="25" width="90" height="5" rx="2.5" fill="#3B82F6" opacity="0.5" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 100 200" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="metal" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="50%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
      </defs>
      <rect x="35" y="40" width="30" height="140" rx="15" fill="url(#metal)" />
      <path d="M20 20 C20 0, 80 0, 80 20 L80 50 C80 60, 70 70, 50 70 C30 70, 20 60, 20 50 Z" fill="url(#metal)" />
      <circle cx="50" cy="30" r="15" fill="#F4F6F9" />
    </svg>
  );
}

function ScrewdriverIcon() {
  return (
    <svg viewBox="0 0 80 200" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="handle" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="rod" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="50%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <rect x="35" y="10" width="10" height="100" fill="url(#rod)" />
      <rect x="25" y="90" width="30" height="90" rx="10" fill="url(#handle)" />
      <rect x="30" y="95" width="5" height="80" rx="2.5" fill="#EFF6FF" opacity="0.6" />
    </svg>
  );
}

function HexKeyIcon() {
  return (
    <svg viewBox="0 0 100 150" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hex" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>
      <path d="M20 20 L80 20 C90 20, 90 30, 90 40 L90 140 C90 150, 70 150, 70 140 L70 50 C70 45, 65 40, 60 40 L20 40 C10 40, 10 20, 20 20 Z" fill="url(#hex)" />
    </svg>
  );
}
