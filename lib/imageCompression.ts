// 업로드 전 브라우저에서 이미지를 리사이즈/재압축합니다.
// Vercel 서버 함수의 요청 용량 제한(약 4.5MB)에 걸리지 않도록,
// 스마트폰 원본 사진(장당 5~10MB+)을 적당한 크기로 줄여서 보냅니다.
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<File> {
  // GIF는 재압축하면 애니메이션이 깨지므로 원본 그대로 둡니다.
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;

    // 이미 충분히 작은 파일이면(압축본이 더 크면) 원본을 그대로 사용
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // 압축에 실패하면 원본 그대로 시도 (서버 쪽 용량 체크가 최종 방어선)
    return file;
  }
}

export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f)));
}
