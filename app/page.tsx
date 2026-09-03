import Link from "next/link";
import { isAdminSession } from "@/lib/admin";
import {
  getAllItems,
  sortByDate,
  filterNotPast,
  formatYearMonthLabel,
  SHOW_OPENING_MODAL,
  SHOW_TRAINING_MODAL,
  OPENING_NOTICE_TITLE,
  isOpeningPeriodOver,
  TRAINING_NOTICE_TITLE,
} from "@/lib/notion";
import { getTodayKST } from "@/lib/calendar";
import { PageBackground, SiteFooter } from "./components/PageBackground";
import { OpeningRegistrationModal } from "./components/OpeningRegistrationModal";
import { TrainingModal } from "./components/TrainingModal";
import { OpeningNoticeOpener } from "./components/OpeningNoticeOpener";
import { TrainingNoticeOpener } from "./components/TrainingNoticeOpener";
import { AddItemButton } from "./components/AddItemButton";
import { EditItemButton } from "./components/EditItemButton";
import { ActivityRow, EmptyState } from "./components/ActivityRow";
import { ActivityCard } from "./components/ActivityCard";
import { ProjectCard } from "./components/ProjectCard";
import { SectionHeader } from "./components/SectionHeader";

// Notion 데이터는 60초마다 최신 내용으로 다시 불러옵니다.
export const revalidate = 60;

export default async function Home() {
  const [isAdmin, allSchedule, allActivities, allAwards, allProjects, allNoticesRaw] = await Promise.all([
    isAdminSession(),
    getAllItems("schedule"),
    getAllItems("activities"),
    getAllItems("awards"),
    getAllItems("projects"),
    getAllItems("notices"),
  ]);

  const todayStr = getTodayKST().dateStr;

  // 접수 마감 시각이 지나면 "개강총회 신청" 공지는 목록/배너에서 자동으로 숨깁니다.
  const openingOver = isOpeningPeriodOver();
  const allNotices = allNoticesRaw.filter((n) => !(n.title === OPENING_NOTICE_TITLE && openingOver));
  const showOpeningModal = SHOW_OPENING_MODAL && !openingOver;

  // 중요 공지: 최신순으로 3개만
  const importantNotices = sortByDate(
    allNotices.filter((n) => n.important),
    "date",
    "descending"
  ).slice(0, 3);

  // 활동: 종료일이 가장 최신인 것부터, 홈페이지엔 3개만
  const activities = sortByDate(allActivities, "end", "descending").slice(0, 4);

  // 수상: 날짜 최신순 (기존과 동일)
  const awards = sortByDate(allAwards, "date", "descending").slice(0, 3);

  // 일정: 아직 끝나지 않은(오늘 이후) 것만, 가까운 순으로
  const schedule = sortByDate(filterNotPast(allSchedule, todayStr), "start", "ascending").slice(0, 4);

  // 프로젝트: 아직 끝나지 않은(진행중) 것만, 최근에 시작한 순으로
  const projects = sortByDate(filterNotPast(allProjects, todayStr), "start", "descending").slice(0, 6);

  return (
    <PageBackground>
      {showOpeningModal ? <OpeningRegistrationModal /> : SHOW_TRAINING_MODAL && <TrainingModal />}

      {importantNotices.length > 0 && (
        <div className="border-b border-red-100 bg-red-50/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:gap-5">
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#B5504F] px-2.5 py-1 text-[10px] font-black tracking-widest text-white">
              중요공지
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
              {importantNotices.map((notice) => {
                if (notice.title === OPENING_NOTICE_TITLE) {
                  return (
                    <OpeningNoticeOpener key={notice.id}>
                      <span className="truncate text-sm font-bold text-[#9C3F3E] transition hover:text-[#7A2F2E] hover:underline">
                        {notice.title}
                      </span>
                    </OpeningNoticeOpener>
                  );
                }
                if (notice.title === TRAINING_NOTICE_TITLE) {
                  return (
                    <TrainingNoticeOpener key={notice.id}>
                      <span className="truncate text-sm font-bold text-[#9C3F3E] transition hover:text-[#7A2F2E] hover:underline">
                        {notice.title}
                      </span>
                    </TrainingNoticeOpener>
                  );
                }
                return (
                  <Link
                    key={notice.id}
                    href="/notices"
                    className="truncate text-sm font-bold text-[#9C3F3E] transition hover:text-[#7A2F2E] hover:underline"
                  >
                    {notice.title}
                  </Link>
                );
              })}
            </div>
            <Link
              href="/notices"
              className="shrink-0 text-xs font-bold text-[#B5504F] underline-offset-2 hover:underline"
            >
              전체 공지 보기
            </Link>
          </div>
        </div>
      )}

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

        </div>
      </section>

      {/* 메인 컨텐츠 영역 (섹션들) */}
      <div className="flex flex-col gap-32 pb-32">
        {/* SEC-01: 활동 내역 */}
        <section id="activities" className="mx-auto w-full max-w-7xl px-6 scroll-mt-24">
          <SectionHeader
            num="1"
            title="Activities"
            desc="우리가 만들어온 발자취입니다."
            action={
              <div className="flex items-center gap-2">
                {isAdmin && <AddItemButton dbKey="activities" />}
                <Link
                  href="/activities"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold tracking-wide text-slate-500 shadow-sm transition hover:text-[#1E3A8A]"
                >
                  전체 보기
                </Link>
              </div>
            }
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {activities.length === 0 && <EmptyState label="아직 등록된 활동 내역이 없습니다." />}
            {activities.map((item) => (
              <ActivityCard key={item.id} item={item} isAdmin={isAdmin} href={`/activities/${item.id}`} />
            ))}
          </div>
        </section>

        {/* SEC-02: 수상 내역 */}
        <section id="awards" className="mx-auto w-full max-w-7xl px-6 scroll-mt-24">
          <SectionHeader
            num="2"
            title="Awards"
            desc="우리가 만들어온 성과입니다."
            action={
              <div className="flex items-center gap-2">
                {isAdmin && <AddItemButton dbKey="awards" />}
                <Link
                  href="/awards"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold tracking-wide text-slate-500 shadow-sm transition hover:text-[#1E3A8A]"
                >
                  전체 보기
                </Link>
              </div>
            }
          />
          <div className="flex flex-col gap-4">
            {awards.length === 0 && <EmptyState label="아직 등록된 수상 내역이 없습니다." />}
            {awards.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                dbKey="awards"
                href={`/awards/${item.id}`}
                dateLabelOverride={formatYearMonthLabel(item.date)}
              />
            ))}
          </div>
        </section>

        {/* SEC-03: 동아리 일정 */}
        <section id="schedule" className="mx-auto w-full max-w-7xl px-6 scroll-mt-24">
          <SectionHeader
            num="3"
            title="Schedule"
            desc="올해 진행될 CHIRO의 주요 일정입니다."
            action={
              <div className="flex items-center gap-2">
                {isAdmin && <AddItemButton dbKey="schedule" />}
                <Link
                  href="/schedule"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold tracking-wide text-slate-500 shadow-sm transition hover:text-[#1E3A8A]"
                >
                  달력 보기
                </Link>
              </div>
            }
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {schedule.length === 0 && <EmptyState label="아직 등록된 일정이 없습니다." />}
            {schedule.slice(0, 4).map((item, i) => {
              const isOngoing =
                !!item.startDate &&
                item.startDate <= todayStr &&
                todayStr <= (item.endDate || item.startDate);

              return (
                <div key={item.id} className="relative rounded-[2rem] border border-white bg-white/60 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-transform hover:-translate-y-1">
                  {isOngoing && (
                    <span className="absolute right-4 top-4 rounded-md bg-red-700 px-2 py-1 text-[10px] font-black tracking-widest text-white">
                      진행중
                    </span>
                  )}
                  {isAdmin && (
                    <EditItemButton
                      dbKey="schedule"
                      pageId={item.id}
                      initialValues={{ title: item.title, startDate: item.startDate, endDate: item.endDate, detail: item.detail }}
                      className={`absolute right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-[#1E3A8A] ${
                        isOngoing ? "top-14" : "top-4"
                      }`}
                    />
                  )}
                  <Link href={`/schedule/${item.id}`} className="block">
                    <p className="mb-4 text-4xl font-black text-slate-200" style={{ fontFamily: "var(--font-chakra)" }}>
                      0{i + 1}
                    </p>
                    <p className="text-lg font-bold text-slate-700">{item.title}</p>
                    <p className="mt-2 text-sm font-bold text-[#1E3A8A]">{item.dateLabel}</p>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* SEC-04: 프로젝트 */}
        <section id="projects" className="mx-auto w-full max-w-7xl px-6 scroll-mt-24">
          <SectionHeader
            num="4"
            title="Projects"
            desc="현재 진행 중인 프로젝트 목록입니다. 완료된 프로젝트는 전체 보기에서 확인하실 수 있습니다."
            action={
              <div className="flex items-center gap-2">
                {isAdmin && <AddItemButton dbKey="projects" />}
                <Link
                  href="/projects"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold tracking-wide text-slate-500 shadow-sm transition hover:text-[#1E3A8A]"
                >
                  전체 보기
                </Link>
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {projects.length === 0 && <EmptyState label="아직 등록된 프로젝트가 없습니다." />}
            {projects.slice(0, 6).map((project) => (
              <ProjectCard key={project.id} project={project} isAdmin={isAdmin} href={`/projects/${project.id}`} />
            ))}
          </div>
        </section>
      </div>

      <SiteFooter />
    </PageBackground>
  );
}
