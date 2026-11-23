import { describe, it, expect, vi, afterEach } from 'vitest';

import { cloudinary } from '../src/config/cloudinary.js';
import { uploadQuestionPhoto, deletePhoto } from '../src/lib/photos.js';

// The spies replace the SDK's own functions, so nothing here reaches Cloudinary
afterEach(() => vi.restoreAllMocks());

const FILE = { mimetype: 'image/jpeg', buffer: Buffer.from('not really a jpeg') };

describe('uploadQuestionPhoto', () => {
    it('sends the photo from memory into the questions folder, resized, and returns its address and name', async () => {
        const upload = vi.spyOn(cloudinary.uploader, 'upload')
            .mockResolvedValue({ public_id: 'world-quiz/test/questions/abc123', version: 1700000000 });

        const photo = await uploadQuestionPhoto(FILE);

        expect(upload).toHaveBeenCalledWith(
            `data:image/jpeg;base64,${FILE.buffer.toString('base64')}`,
            { folder: 'world-quiz/test/questions', resource_type: 'image', transformation: [{ width: 1600, crop: 'limit' }] },
        );
        expect(photo).toEqual({
            imageUrl: expect.stringMatching(/\/f_auto,q_auto\/v1700000000\/world-quiz\/test\/questions\/abc123$/),
            cloudinaryId: 'world-quiz/test/questions/abc123',
        });
    });

    it("turns a file Cloudinary can't read as an image into a 400 under the photo field", async () => {
        vi.spyOn(cloudinary.uploader, 'upload').mockRejectedValue({ http_code: 400, message: 'Invalid image file' });
        await expect(uploadQuestionPhoto(FILE)).rejects.toMatchObject({
            status: 400,
            details: [{ path: 'body.photo', message: "This file can't be read as a photo. Please choose another." }],
        });
    });

    it('lets any other failure through as it is, so it becomes a 500', async () => {
        const outage = new Error('Cloudinary is down');
        vi.spyOn(cloudinary.uploader, 'upload').mockRejectedValue(outage);
        await expect(uploadQuestionPhoto(FILE)).rejects.toBe(outage);
    });
});

describe('deletePhoto', () => {
    it("removes the photo and clears it from Cloudinary's cache", async () => {
        const destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
        await deletePhoto('world-quiz/test/questions/abc123');
        expect(destroy).toHaveBeenCalledWith('world-quiz/test/questions/abc123', { resource_type: 'image', invalidate: true });
    });

    it('logs a failure instead of throwing it', async () => {
        vi.spyOn(cloudinary.uploader, 'destroy').mockRejectedValue(new Error('Cloudinary is down'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(deletePhoto('world-quiz/test/questions/abc123')).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });
});
