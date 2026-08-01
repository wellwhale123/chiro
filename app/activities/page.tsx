import { isAdminSession } from "@/lib/admin";
import { getSortedItems } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { ActivityRow, EmptyState } from "../components/ActivityRow";
import { AddItemButton } from "../components/AddItemButton";

export const revalidate = 60;

export default async function ActivitiesPage() {
  const [isAdmin, items] = await Promise.all([isAdminSession(), getSortedItems("activities")]);

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-4xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader
          num="1"
          title="Activities"
          desc="CHIRO가 지금까지 만들어온 발자취입니다."
          action={isAdmin && <AddItemButton dbKey="activities" />}
        />
        <div className="flex flex-col gap-4">
          {items.length === 0 && <EmptyState label="아직 등록된 활동 내역이 없습니다." />}
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} isAdmin={isAdmin} dbKey="activities" href={`/activities/${item.id}`} />
          ))}
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
