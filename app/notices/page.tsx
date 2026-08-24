import { isAdminSession } from "@/lib/admin";
import { getAllItems, sortByDate, SHOW_OPENING_MODAL } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/ActivityRow";
import { AnnouncementCard } from "../components/AnnouncementCard";
import { AddItemButton } from "../components/AddItemButton";
import { OpeningRegistrationButton } from "../components/OpeningRegistrationButton";

export const revalidate = 60;

export default async function NoticesPage() {
  const [isAdmin, rawItems] = await Promise.all([isAdminSession(), getAllItems("notices")]);

  // 날짜 최신순으로 먼저 정렬한 뒤, 중요공지를 맨 위로 고정합니다.
  const byDate = sortByDate(rawItems, "date", "descending");
  const items = [...byDate].sort((a, b) => Number(b.important) - Number(a.important));

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-3xl px-6 pb-32 pt-20 lg:pt-32">
        <SectionHeader
          num="0"
          title="Notice"
          desc="CHIRO의 공지사항입니다."
          action={
            <div className="flex items-center gap-2">
              {SHOW_OPENING_MODAL && <OpeningRegistrationButton />}
              {isAdmin && <AddItemButton dbKey="notices" />}
            </div>
          }
        />
        <div className="flex flex-col gap-4">
          {items.length === 0 && <EmptyState label="아직 등록된 공지사항이 없습니다." />}
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} isAdmin={isAdmin} />
          ))}
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
