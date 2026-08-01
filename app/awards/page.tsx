import { isAdminSession } from "@/lib/admin";
import { getAllItems, sortByDate, formatYearMonthLabel, type NormalizedItem } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { ActivityRow, EmptyState } from "../components/ActivityRow";
import { AddItemButton } from "../components/AddItemButton";

export const revalidate = 60;

export default async function AwardsPage() {
  const [isAdmin, rawItems] = await Promise.all([isAdminSession(), getAllItems("awards")]);
  const items: NormalizedItem[] = sortByDate(rawItems, "date", "descending");

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-4xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader
          num="2"
          title="Awards"
          desc="CHIRO가 만들어온 성과입니다."
          action={isAdmin && <AddItemButton dbKey="awards" />}
        />
        <div className="flex flex-col gap-4">
          {items.length === 0 && <EmptyState label="아직 등록된 수상 내역이 없습니다." />}
          {items.map((item) => (
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
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
