// 업로드 전 브라우저에서 이미지를 리사이즈/재압축합니다.
// Vercel 서버 함수의 요청 용량 제한(약 4.5MB)에 걸리지 않도록,
// 스마트폰 원본 사진(장당 5~10MB+)을 적당한 크기로 줄여서 보냅니다.
// 아이폰/일부 갤럭시에서 저장되는 HEIC/HEIF 형식은 브라우저가 직접 못 읽기 때문에
// 먼저 JPEG로 변환한 뒤 같은 방식으로 리사이즈합니다.

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // 일부 OS/브라우저 조합에서는 HEIC 파일의 type이 빈 문자열로 전달되기도 해서 확장자로도 확인합니다.
  return /\.hei[cf]$/i.test(file.name);
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<File> {
  // GIF는 재압축하면 애니메이션이 깨지므로 원본 그대로 둡니다.
  if (file.type === "image/gif") return file;

  let workingFile = file;

  if (isHeic(file)) {
    try {
      workingFile = await convertHeicToJpeg(file);
    } catch {
      // 변환에 실패하면 원본을 그대로 반환합니다 (서버에서 형식 오류로 안내됩니다).
      return file;
    }
  }

  try {
    const bitmap = await createImageBitmap(workingFile);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return workingFile;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return workingFile;

    // 이미 충분히 작은 파일이면(압축본이 더 크면) 그대로 사용
    if (blob.size >= workingFile.size) return workingFile;

    const newName = workingFile.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // 압축에 실패하면 (HEIC 변환된) 원본이라도 그대로 시도 (서버 쪽 용량 체크가 최종 방어선)
    return workingFile;
  }
}

export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f)));
}
