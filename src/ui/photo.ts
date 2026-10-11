/**
 * Shrinks a picked photo to a small square JPEG data URL. Member photos live
 * inside the synced document, so they have to stay tiny (~10 KB).
 */
export async function photoToDataUrl(file: File, size = 192): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot resize images.')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}
