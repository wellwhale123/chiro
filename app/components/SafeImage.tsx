"use client";

import { useState } from "react";

const MAX_RETRIES = 3;

export function SafeImage({
  src,
  alt,
  className,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // src가 바뀌면(다른 사진으로 전환 등) 렌더링 중에 상태를 초기화합니다.
  if (src !== prevSrc) {
    setPrevSrc(src);
    setAttempt(0);
    setFailed(false);
  }

  function handleError() {
    if (attempt < MAX_RETRIES) {
      const delay = 700 * (attempt + 1);
      setTimeout(() => setAttempt((a) => a + 1), delay);
    } else {
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-center text-xs font-medium text-slate-400 ${className ?? ""}`}>
        사진을 불러오지 못했습니다
      </div>
    );
  }

  return (
    // key를 바꿔서 강제로 새 엘리먼트를 만들면, 브라우저가 해당 URL을 다시 요청합니다.
    // eslint-disable-next-line @next/next/no-img-element
    <img key={attempt} src={src} alt={alt} className={className} onClick={onClick} onError={handleError} />
  );
}
