import type { Metadata } from "next";
import { Chakra_Petch } from "next/font/google";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "CHIRO | Club for Human Intelligence Robot",
  description:
    "CHIRO — Club for Human Intelligence Robot. 인간 지능과 로봇이 만나는 대학 로봇 동아리.",
};

const navLinks = [
  { href: "/about", label: "임원진 소개" },
  { href: "/awards", label: "활동 및 수상 내역" },
  { href: "/schedule", label: "동아리 일정" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // scroll-smooth를 추가해서 메뉴 클릭 시 부드럽게 이동하도록 설정
    <html lang="ko" className={`${chakraPetch.variable} h-full scroll-smooth`}>
      {/* 칙칙한 bg-black을 지우고 화사한 파스텔 배경(bg-[#F4F6F9]) 적용 */}
      <body className="flex min-h-full flex-col bg-[#F4F6F9] font-sans text-slate-800 antialiased">
        
        {/* Header - 반투명 유리 질감(backdrop-blur) 적용 */}
        <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-[#F4F6F9]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            
            {/* Logo */}
            <a href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <span className="text-[11px] font-black tracking-widest text-[#1E3A8A]" style={{ fontFamily: "var(--font-chakra)" }}>
                  CR
                </span>
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-lg font-black tracking-[0.15em] uppercase" style={{ fontFamily: "var(--font-chakra)" }}>
                  <span className="text-slate-800">CHI</span>
                  <span className="text-[#1E3A8A]">RO</span>
                </span>
                <span className="hidden mt-1 text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase sm:block">
                  Human Intelligence Robot
                </span>
              </span>
            </a>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-2 md:flex" aria-label="주요 메뉴">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-4 py-2 text-sm font-bold tracking-wide text-slate-500 uppercase transition duration-300 hover:bg-white/50 hover:text-[#1E3A8A]"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Mobile nav */}
            <nav
              className="flex max-w-[55%] flex-wrap items-center justify-end gap-x-3 gap-y-1 md:hidden"
              aria-label="모바일 메뉴"
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-xs font-bold tracking-wide text-slate-500 uppercase transition hover:text-[#1E3A8A]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
