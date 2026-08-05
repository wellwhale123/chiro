import type { MetadataRoute } from "next";
import { getAllItems } from "@/lib/notion";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://chiro-bay.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/about`, priority: 0.8 },
    { url: `${SITE_URL}/about/club`, priority: 0.6 },
    { url: `${SITE_URL}/about/officers`, priority: 0.6 },
    { url: `${SITE_URL}/about/directions`, priority: 0.6 },
    { url: `${SITE_URL}/notices`, priority: 0.7 },
    { url: `${SITE_URL}/activities`, priority: 0.7 },
    { url: `${SITE_URL}/awards`, priority: 0.7 },
    { url: `${SITE_URL}/schedule`, priority: 0.6 },
    { url: `${SITE_URL}/projects`, priority: 0.7 },
    { url: `${SITE_URL}/alumni`, priority: 0.5 },
  ];

  // 활동/수상/일정/프로젝트 상세 페이지도 검색엔진이 찾을 수 있도록 함께 등록합니다.
  const [activities, awards, schedule, projects] = await Promise.all([
    getAllItems("activities").catch(() => []),
    getAllItems("awards").catch(() => []),
    getAllItems("schedule").catch(() => []),
    getAllItems("projects").catch(() => []),
  ]);

  const detailRoutes: MetadataRoute.Sitemap = [
    ...activities.map((item) => ({ url: `${SITE_URL}/activities/${item.id}`, priority: 0.5 })),
    ...awards.map((item) => ({ url: `${SITE_URL}/awards/${item.id}`, priority: 0.5 })),
    ...schedule.map((item) => ({ url: `${SITE_URL}/schedule/${item.id}`, priority: 0.4 })),
    ...projects.map((item) => ({ url: `${SITE_URL}/projects/${item.id}`, priority: 0.5 })),
  ];

  return [...staticRoutes, ...detailRoutes];
}
