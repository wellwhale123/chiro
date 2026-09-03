import { isAdminSession } from "@/lib/admin";
import {
  getAllItems,
  sortByDate,
  OPENING_NOTICE_TITLE,
  isOpeningPeriodOver,
  TRAINING_NOTICE_TITLE,
  SHOW_TRAINING_MODAL,
  isTrainingModalTimeWindowOpen,
} from "@/lib/notion";
import { PageBackground, SiteFooter } from "../components/PageBackground";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/ActivityRow";
import { AnnouncementCard } from "../components/AnnouncementCard";
import { AddItemButton } from "../components/AddItemButton";
import { OpeningNoticeOpener } from "../components/OpeningNoticeOpener";
import { TrainingNoticeOpener } from "../components/TrainingNoticeOpener";
import { TrainingAvailabilitySummary } from "../components/TrainingAvailabilitySummary";

export const revalidate = 60;

export default async function NoticesPage() {
  const [isAdmin, rawItemsAll] = await Promise.all([isAdminSession(), getAllItems("notices")]);

  // 접수 마감 시각이 지나면 "개강총회 신청" 공지는 목록에서 자동으로 숨깁니다.
  // 교육 신청은 SHOW_TRAINING_MODAL이 켜져 있고, 오늘 오후 4시 이전일 때만 보여줍니다.
  const openingOver = isOpeningPeriodOver();
  const trainingVisible = SHOW_TRAINING_MODAL && isTrainingModalTimeWindowOpen();
  const rawItems = rawItemsAll.filter(
    (n) =>
      !(n.title === OPENING_NOTICE_TITLE && openingOver) &&
      !(n.title === TRAINING_NOTICE_TITLE && !trainingVisible)
  );

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
          action={isAdmin && <AddItemButton dbKey="notices" />}
        />
        <div className="flex flex-col gap-4">
          {items.length === 0 && <EmptyState label="아직 등록된 공지사항이 없습니다." />}
          {items.map((item) => {
            if (item.title === OPENING_NOTICE_TITLE) {
              return (
                <OpeningNoticeOpener key={item.id}>
                  <AnnouncementCard item={item} isAdmin={isAdmin} />
                </OpeningNoticeOpener>
              );
            }
            if (item.title === TRAINING_NOTICE_TITLE) {
              return (
                <div key={item.id} className="flex flex-col gap-2">
                  <TrainingNoticeOpener>
                    <AnnouncementCard item={item} isAdmin={isAdmin} />
                  </TrainingNoticeOpener>
                  <TrainingAvailabilitySummary />
                </div>
              );
            }
            return <AnnouncementCard key={item.id} item={item} isAdmin={isAdmin} />;
          })}
        </div>
      </div>
      <SiteFooter />
    </PageBackground>
  );
}
