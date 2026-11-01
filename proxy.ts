import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, isValidSessionToken } from "@/lib/admin";
import { MAINTENANCE_MODE, MAINTENANCE_MESSAGE } from "@/lib/maintenance";

// 점검 모드일 때, 관리자 세션이 아닌 요청은 API를 쓰지 못하게 막습니다(신청/취소/조회 등).
// 관리자 로그인/로그아웃 API는 점검 중에도 열어둡니다. 페이지 화면은 app/layout.tsx에서 처리합니다.
export function proxy(request: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (path === "/api/admin/login" || path === "/api/admin/logout") return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (isValidSessionToken(token)) return NextResponse.next();

  return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 });
}

export const config = {
  matcher: "/api/:path*",
};
