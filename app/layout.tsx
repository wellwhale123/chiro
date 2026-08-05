import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Chakra_Petch } from "next/font/google";
import "./globals.css";
import { isAdminSession } from "@/lib/admin";
import { AdminBadge } from "./components/AdminBadge";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://chiro-bay.vercel.app"),
  title: {
    default: "CHIRO(치로) | 중앙대학교 로봇동아리",
    template: "%s | CHIRO 중앙대학교 로봇동아리",
  },
  description:
    "중앙대학교 로봇동아리 CHIRO(치로) 공식 홈페이지. 2001년 창단, 공과대학 유일 로봇동아리로 로봇 제작 프로젝트와 대회 수상 실적을 소개합니다.",
  keywords: [
    "중앙대 치로",
    "중앙대학교 치로",
    "중앙대 로봇동아리",
    "중앙대로봇",
    "중앙대학교 로봇동아리",
    "CHIRO",
    "치로",
    "중앙대 공대 동아리",
    "Chung-Ang University Robotics Club",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "CHIRO",
    title: "CHIRO(치로) | 중앙대학교 로봇동아리",
    description:
      "중앙대학교 로봇동아리 CHIRO(치로) 공식 홈페이지. 로봇 제작 프로젝트, 대회 수상, 활동 소식을 확인하세요.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "CHIRO(치로) | 중앙대학교 로봇동아리",
    description: "중앙대학교 로봇동아리 CHIRO(치로) 공식 홈페이지",
  },
  robots: { index: true, follow: true },
};

const navLinks = [
  { href: "/about", label: "소개" },
  { href: "/notices", label: "공지사항" },
  { href: "/activities", label: "활동내역" },
  { href: "/awards", label: "수상내역" },
  { href: "/schedule", label: "일정" },
  { href: "/projects", label: "프로젝트" },
  { href: "/alumni", label: "졸업생" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminSession();

  return (
    // scroll-smooth를 추가해서 메뉴 클릭 시 부드럽게 이동하도록 설정
    <html lang="ko" className={`${chakraPetch.variable} h-full scroll-smooth`}>
      {/* 심플하고 세련된 화이트 베이스 배경 */}
      <body className="flex min-h-full flex-col bg-white font-sans text-slate-800 antialiased">
        
        {/* Header - 남색 배경 (CHIRO 로고 색과 통일), 유리 질감 유지 */}
        <header className="sticky top-0 z-50 border-b border-blue-900/30 bg-[#1E3A8A]/95 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            
            {/* Logo */}
            <Link href="/">
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white p-1.5 shadow-sm">
                  <Image src="/logo.png" alt="CHIRO 로고" width={40} height={40} className="h-full w-full object-contain" priority />
                </span>
                <span className="flex flex-col leading-none">
                  <span className="text-lg font-black tracking-[0.15em] uppercase" style={{ fontFamily: "var(--font-chakra)" }}>
                    <span className="text-white">CHI</span>
                    <span className="text-blue-300">RO</span>
                  </span>
                  <span className="hidden mt-1 text-[9px] font-bold tracking-[0.15em] text-blue-200 uppercase sm:block">
                    Club for Human Intelligent Robot
                  </span>
                </span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-2 md:flex" aria-label="주요 메뉴">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-4 py-2 text-sm font-bold tracking-wide text-blue-100 uppercase transition duration-300 hover:bg-white/10 hover:text-white"
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
                  className="text-xs font-bold tracking-wide text-blue-100 uppercase transition hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>

        {isAdmin && <AdminBadge />}
      </body>
    </html>
  );
}
