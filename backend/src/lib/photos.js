import { cloudinary, questionImageFolder, questionImageUrl } from '../config/cloudinary.js';
import { fieldError } from './errors.js';

// Sends a question photo held in memory to Cloudinary. Returns the address to show and Cloudinary's name for it
export async function uploadQuestionPhoto(file) {
    // A data URI carries the bytes straight from memory, so the server never writes a temporary file
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    try {
        const result = await cloudinary.uploader.upload(dataUri, {
            // Passed apart from the name, so the Media Library shows the photo in its folder
            folder: questionImageFolder,
            resource_type: 'image',
            transformation: [{ width: 1600, crop: 'limit' }],
        });
        return { imageUrl: questionImageUrl(result), cloudinaryId: result.public_id };
    } catch (error) {
        // Cloudinary answers 400 for a file whose bytes aren't an image, whatever its type said
        if (error.http_code === 400) {
            throw fieldError(400, 'photo', "This file can't be read as a photo. Please choose another.");
        }
        throw error;
    }
}

// Removes a photo no question uses any more. A failure is logged, not thrown: the database has
// already changed, and a leftover photo costs only storage
export async function deletePhoto(cloudinaryId) {
    try {
        await cloudinary.uploader.destroy(cloudinaryId, { resource_type: 'image', invalidate: true });
    } catch (error) {
        console.warn(`Could not delete photo ${cloudinaryId}:`, error.message);
    }
}
