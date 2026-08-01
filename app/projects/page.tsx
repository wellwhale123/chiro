import { isAdminSession } from "@/lib/admin";
import { getSortedItems } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/ActivityRow";
import { ProjectCard } from "../components/ProjectCard";
import { AddItemButton } from "../components/AddItemButton";

export const revalidate = 60;

export default async function ProjectsPage() {
  const [isAdmin, items] = await Promise.all([isAdminSession(), getSortedItems("projects")]);

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-6xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader
          num="4"
          title="Projects"
          desc="치열하게 고민하고 설계한 우리의 작업물들입니다."
          action={isAdmin && <AddItemButton dbKey="projects" />}
        />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 && <EmptyState label="아직 등록된 프로젝트가 없습니다." />}
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} isAdmin={isAdmin} href={`/projects/${project.id}`} />
          ))}
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
