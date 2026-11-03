// Loads a photo file into a canvas. Browsers apply the photo's orientation when
// drawing an <img>, on both Android and iPhone.

export const MAX_PHOTO_SIZE = 3000; // longest side, to stay within Safari's memory limits

export async function loadPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        try {
            await img.decode();
        } catch {
            throw new Error('This phone saved the photo in a format the browser cannot read. Try setting the camera to "Most Compatible" (JPEG).');
        }
        const k = Math.min(1, MAX_PHOTO_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * k);
        canvas.height = Math.round(img.naturalHeight * k);
        canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas;
    } finally {
        URL.revokeObjectURL(url);
    }
}
