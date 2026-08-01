import { notFound } from "next/navigation";
import { getAllItems, sortByDate, filterNotPast, filterPast } from "@/lib/notion";
import { getTodayKST } from "@/lib/calendar";
import { PageBackground, SiteFooter } from "../../components/PageBackground";
import { DetailView } from "../../components/DetailView";

export const revalidate = 60;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const all = await getAllItems("projects");
  const todayStr = getTodayKST().dateStr;

  // 목록 페이지와 같은 순서(진행중: 시작일 최신순 -> 완료: 종료일 최신순)로 이전/다음을 이동합니다.
  const ongoing = sortByDate(filterNotPast(all, todayStr), "start", "descending");
  const ended = sortByDate(filterPast(all, todayStr), "end", "descending");
  const items = [...ongoing, ...ended];
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) notFound();

  const item = items[index];
  const prevId = index > 0 ? items[index - 1].id : null;
  const nextId = index < items.length - 1 ? items[index + 1].id : null;

  return (
    <PageBackground>
      <DetailView
        item={item}
        basePath="/projects"
        prevId={prevId}
        nextId={nextId}
        backHref="/projects"
        backLabel="목록으로"
      />
      <SiteFooter />
    </PageBackground>
  );
}
