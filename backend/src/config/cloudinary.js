import { v2 as cloudinary } from 'cloudinary';

import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, NODE_ENV } from './env.js';

if (NODE_ENV !== 'test' && !(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must all be defined');
}

cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
});

// A folder per NODE_ENV, so development's photos never mix with production's
export const questionImageFolder = `world-quiz/${NODE_ENV}/questions`;

// The address the frontend shows: WebP or AVIF where the browser takes them, at the quality Cloudinary picks
export function questionImageUrl({ public_id: publicId, version }) {
    // urlAnalytics off: no `?_a=` SDK tag on the end, so the address is the same after a package update
    return cloudinary.url(publicId, { version, fetch_format: 'auto', quality: 'auto', urlAnalytics: false });
}

export { cloudinary };
