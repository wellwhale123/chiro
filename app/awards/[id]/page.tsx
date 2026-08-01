import { notFound } from "next/navigation";
import { getAllItems, sortByDate, formatYearMonthLabel } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../../components/PageBackground";
import { DetailView } from "../../components/DetailView";

export const revalidate = 60;

export default async function AwardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const items = sortByDate(await getAllItems("awards"), "date", "descending");
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) notFound();

  const item = items[index];
  const prevId = index > 0 ? items[index - 1].id : null;
  const nextId = index < items.length - 1 ? items[index + 1].id : null;

  return (
    <PageBackground>
      <DetailView
        item={item}
        basePath="/awards"
        prevId={prevId}
        nextId={nextId}
        backHref="/awards"
        backLabel="목록으로"
        dateLabelOverride={formatYearMonthLabel(item.date)}
      />
      <SiteFooter />
    </PageBackground>
  );
}
