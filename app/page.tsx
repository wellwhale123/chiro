import { ArrowRight } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import {
  queryDatabase,
  getTitleText,
  getRichText,
  getDateStart,
  getFirstFileUrl,
  getTagLabel,
  formatMonthLabel,
  formatYearLabel,
} from "@/lib/notion";
import { PhotoUploadOverlay } from "./components/PhotoUploadOverlay";

// Notion 데이터는 60초마다 최신 내용으로 다시 불러옵니다.
export const revalidate = 60;

// 고급스러운 파스텔 톤 3D 느낌을 위한 공구 데이터 (스크롤 시 배경에 고정됨)
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

async function getScheduleItems() {
  const pages = await queryDatabase("schedule", { sortProperty: "순서" });
  return pages.map((p) => ({
    id: p.id,
    title: getTitleText(p),
    month: formatMonthLabel(getDateStart(p)),
  }));
}

async function getActivityOrAwardItems(key: "activities" | "awards") {
  const pages = await queryDatabase(key, { sortProperty: "순서" });
  return pages.map((p) => ({
    id: p.id,
    title: getTitleText(p),
    detail: getRichText(p, "상세 내용"),
    year: formatYearLabel(getDateStart(p)),
    photoUrl: getFirstFileUrl(p),
  }));
}

async function getProjectItems() {
  const pages = await queryDatabase("projects", { sortProperty: "순서" });
  return pages.map((p) => ({
    id: p.id,
    title: getTitleText(p),
    tag: getTagLabel(p),
    detail: getRichText(p, "상세내용"),
    photoUrl: getFirstFileUrl(p),
  }));
}

export default async function Home() {
  const [isAdmin, schedule, activities, awards, projects] = await Promise.all([
    isAdminSession(),
    getScheduleItems(),
    getActivityOrAwardItems("activities"),
    getActivityOrAwardItems("awards"),
    getProjectItems(),
  ]);

  return (
    // 전체 배경: 아주 부드럽고 따뜻한 쿨그레이 파스텔 톤
    <div className="relative min-h-screen bg-[#F4F6F9] text-slate-800 selection:bg-blue-200 selection:text-blue-900">
      
      {/* 1. 고정된 3D 배경 레이어 (스크롤해도 따라오지 않고 제자리에 고정됨) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* 타공판(Pegboard) 느낌의 은은한 도트 패턴 */}
        <div 
          className="absolute inset-0 opacity-40" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at center, #CBD5E1 2px, transparent 2px)', 
            backgroundSize: '40px 40px' 
          }} 
        />
        
        {/* 가로 공구 걸이 바 (파스텔 톤) */}
        <div className="absolute top-32 left-0 right-0 h-4 bg-gradient-to-b from-[#E2E8F0] to-[#F1F5F9] shadow-[0_10px_20px_rgba(0,0,0,0.03)] border-y border-white" />
        
        {/* 걸려있는 3D 파스텔 공구들 */}
        {floatingTools.map((tool, index) => (
          <div key={index} className={`absolute ${tool.className}`}>
            <div className={`relative ${tool.bodyClassName}`}>{tool.icon}</div>
          </div>
        ))}
      </div>

      {/* 2. 실제 스크롤되는 컨텐츠 레이어 */}
      <div className="relative z-10 flex min-h-screen flex-col">
        
        {/* HERO SECTION */}
        <section className="flex flex-col justify-center px-6 md:px-20 lg:px-[15%] pb-32 pt-20 lg:pt-32">
          <div className="flex flex-col items-start">
            <p className="mb-4 pl-1 text-sm font-bold tracking-[0.3em] text-slate-500 md:text-base">
              중앙대학교 로봇동아리
            </p>

            <h1
              className="text-[clamp(5rem,15vw,12rem)] font-black leading-[0.85] tracking-tighter"
              style={{ fontFamily: "var(--font-chakra)" }}
            >
              <span className="text-slate-800">CHI</span>
              <span className="text-[#1E3A8A]">RO</span>
            </h1>

            <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="#projects"
                className="flex w-full items-center justify-center rounded-2xl border-2 border-white bg-white/40 px-8 py-4 text-sm font-bold tracking-[0.15em] text-slate-600 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#1E3A8A] hover:text-[#1E3A8A] sm:w-fit"
              >
                프로젝트 보기
              </a>
            </div>
          </div>
        </section>

        {/* 메인 컨텐츠 영역 (섹션들) */}
        <div className="flex flex-col gap-32 pb-32">
          
          {/* SEC-01: 활동 내역 */}
          <section id="activities" className="mx-auto w-full max-w-7xl px-6 scroll-mt-24">
            <SectionHeader num="1" title="Activities" desc="우리가 만들어온 발자취입니다." />
            <div className="flex flex-col gap-4">
              {activities.length === 0 && <EmptyState label="아직 등록된 활동 내역이 없습니다." />}
              {activities.map((item) => (
                <ActivityRow key={item.id} item={item} isAdmin={isAdmin} />
              ))}
            </div>
          </section>

          {/* SEC-02: 수상 내역 */}
          <section id="awards" className="mx-auto w-full max-w-7xl px-6 scroll-mt-24">
            <SectionHeader num="2" title="Awards" desc="우리가 만들어온 성과입니다." />
            <div className="flex flex-col gap-4">
              {awards.length === 0 && <EmptyState label="아직 등록된 수상 내역이 없습니다." />}
              {awards.map((item) => (
                <ActivityRow key={item.id} item={item} isAdmin={isAdmin} />
              ))}
            </div>
          </section>

          {/* SEC-03: 동아리 일정 */}
          <section id="schedule" className="mx-auto w-full max-w-7xl px-6 scroll-mt-24">
            <SectionHeader num="3" title="Schedule" desc="올해 진행될 CHIRO의 주요 일정입니다." />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {schedule.length === 0 && <EmptyState label="아직 등록된 일정이 없습니다." />}
              {schedule.map((item, i) => (
                <div key={item.id} className="rounded-[2rem] border border-white bg-white/60 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl">
                  <p className="mb-4 text-4xl font-black text-slate-200" style={{ fontFamily: "var(--font-chakra)" }}>
                    0{i + 1}
                  </p>
                  <p className="text-lg font-bold text-slate-700">{item.title}</p>
                  <p className="mt-2 text-sm font-bold text-[#1E3A8A]">{item.month}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SEC-04: 프로젝트 */}
          <section id="projects" className="mx-auto w-full max-w-7xl px-6 scroll-mt-24">
            <SectionHeader num="4" title="Projects" desc="치열하게 고민하고 설계한 우리의 작업물들입니다." />
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {projects.length === 0 && <EmptyState label="아직 등록된 프로젝트가 없습니다." />}
              {projects.map((project) => (
                <div key={project.id} className="group overflow-hidden rounded-[2rem] border border-white bg-white/60 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-slate-200/50">
                  <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-slate-100 to-[#E2E8F0]">
                    {project.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.photoUrl} alt={project.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-end p-6">
                        <div className="h-full w-full rounded-xl bg-white/40 shadow-sm border border-white/50" />
                      </div>
                    )}
                    {isAdmin && <PhotoUploadOverlay pageId={project.id} />}
                  </div>
                  <div className="p-8">
                    {project.tag && (
                      <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#1E3A8A] uppercase">
                        {project.tag}
                      </p>
                    )}
                    <p className="text-xl font-bold text-slate-800">{project.title}</p>
                    {project.detail && (
                      <p className="mt-2 text-sm text-slate-500">{project.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* FOOTER */}
        <footer className="mt-auto border-t border-slate-200/50 bg-[#F4F6F9]/80 px-6 py-12 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-2xl font-black tracking-[0.15em] text-slate-800 uppercase" style={{ fontFamily: "var(--font-chakra)" }}>
                CHI<span className="text-[#1E3A8A]">RO</span>
              </p>
              <p className="mt-1 text-xs font-bold tracking-[0.1em] text-slate-500 uppercase">
                Chung-Ang University Robotics Club
              </p>
              <a
                href="mailto:chiro@cau.ac.kr"
                className="mt-3 block text-sm font-medium text-slate-400 transition hover:text-[#1E3A8A]"
              >
                chiro@cau.ac.kr
              </a>
            </div>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              © {new Date().getFullYear()} CHIRO. All rights reserved.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 활동/수상 항목 하나를 표시하는 행 (관리자 모드에서는 사진 업로드 가능)
// -------------------------------------------------------------
type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  year: string;
  photoUrl: string | null;
};

function ActivityRow({ item, isAdmin }: { item: ActivityItem; isAdmin: boolean }) {
  return (
    <div className="group flex items-center justify-between gap-6 rounded-2xl border border-white bg-white/50 p-6 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-md">
      <div className="flex min-w-0 items-center gap-6">
        <span className="shrink-0 text-xl font-black text-slate-300 transition-colors group-hover:text-[#1E3A8A]" style={{ fontFamily: "var(--font-chakra)" }}>
          {item.year}
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-700">{item.title}</p>
          {item.detail && <p className="mt-1 truncate text-sm text-slate-500">{item.detail}</p>}
        </div>
      </div>

      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <ArrowRight className="h-4 w-4 text-[#1E3A8A] transition-transform group-hover:translate-x-1" />
        )}
        {isAdmin && <PhotoUploadOverlay pageId={item.id} />}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-8 text-center text-sm font-medium text-slate-400">
      {label}
    </div>
  );
}

// -------------------------------------------------------------
// 깔끔한 타이포그래피 기반의 섹션 헤더 컴포넌트
// -------------------------------------------------------------
function SectionHeader({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="mb-12 flex flex-col items-center text-center sm:items-start sm:text-left">
      <span className="mb-2 text-sm font-black text-[#1E3A8A]" style={{ fontFamily: "var(--font-chakra)" }}>
        0{num}.
      </span>
      <h2 className="text-4xl font-black tracking-tight text-slate-800 md:text-5xl">
        {title}
      </h2>
      <p className="mt-4 max-w-xl text-slate-500">
        {desc}
      </p>
    </div>
  );
}

// -------------------------------------------------------------
// 파스텔 톤 & 3D 질감을 살린 커스텀 SVG 아이콘들 (수정 없음)
// -------------------------------------------------------------

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