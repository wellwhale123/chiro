// 홈페이지 점검 모드. true로 두면 관리자 세션이 아닌 방문자에게는 점검 안내만 보이고,
// 신청 등 모든 API 요청도 막힙니다(관리자 로그인/로그아웃 제외). 점검이 끝나면 false로 바꾸면 됩니다.
// 관리자 로그인은 점검 화면 하단의 "© CHIRO" 문구를 3초 안에 10번 클릭하면 됩니다(평소와 동일한 방식).
export const MAINTENANCE_MODE = true;

export const MAINTENANCE_MESSAGE = "더 나은 서비스를 위해 홈페이지를 잠시 점검하고 있습니다. 잠시 후 다시 방문해 주세요.";
