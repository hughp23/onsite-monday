// Must match UpdateUserRequestValidator.MaxGalleryImages on the backend
export const MAX_GALLERY = 12;

export const canAddToGallery = (gallery: string[]) => gallery.length < MAX_GALLERY;

export function addToGallery(gallery: string[], url: string): string[] {
  if (gallery.includes(url) || !canAddToGallery(gallery)) return gallery;
  return [...gallery, url];
}

export function removeFromGallery(gallery: string[], index: number): string[] {
  if (index < 0 || index >= gallery.length) return gallery;
  return gallery.filter((_, i) => i !== index);
}
