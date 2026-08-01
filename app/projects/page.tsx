import { isAdminSession } from "@/lib/admin";
import { getAllItems, sortByDate, filterNotPast, filterPast } from "@/lib/notion";
import { getTodayKST } from "@/lib/calendar";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/ActivityRow";
import { ProjectCard } from "../components/ProjectCard";
import { AddItemButton } from "../components/AddItemButton";

export const revalidate = 60;

export default async function ProjectsPage() {
  const [isAdmin, all] = await Promise.all([isAdminSession(), getAllItems("projects")]);
  const todayStr = getTodayKST().dateStr;

  const ongoing = sortByDate(filterNotPast(all, todayStr), "start", "descending");
  const ended = sortByDate(filterPast(all, todayStr), "end", "descending");

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-6xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader
          num="4"
          title="Projects"
          desc="치열하게 고민하고 설계한 우리의 작업물들입니다."
          action={isAdmin && <AddItemButton dbKey="projects" />}
        />

        <div className="mb-20">
          <p className="mb-6 text-sm font-black tracking-widest text-[#1E3A8A] uppercase">진행중</p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {ongoing.length === 0 && <EmptyState label="진행중인 프로젝트가 없습니다." />}
            {ongoing.map((project) => (
              <ProjectCard key={project.id} project={project} isAdmin={isAdmin} href={`/projects/${project.id}`} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-6 text-sm font-black tracking-widest text-slate-400 uppercase">완료된 프로젝트</p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {ended.length === 0 && <EmptyState label="완료된 프로젝트가 없습니다." />}
            {ended.map((project) => (
              <ProjectCard key={project.id} project={project} isAdmin={isAdmin} href={`/projects/${project.id}`} />
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
