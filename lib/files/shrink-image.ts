/**
 * Browser-only: re-encode an image as JPEG, at most `maxSide` pixels on the long side.
 * Re-encoding also drops the photo's metadata (EXIF), including the GPS position phones add.
 * Returns the original file if it isn't an image or can't be decoded.
 */
export async function shrinkImage(
  file: File,
  { maxSide = 2400, quality = 0.85, onlyAboveBytes = 0 } = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= onlyAboveBytes) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
