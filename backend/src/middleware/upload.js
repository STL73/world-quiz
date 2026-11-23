import multer from 'multer';

import { fieldError } from '../lib/errors.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const parsePhotoForm = multer({
    // Kept in memory: it goes straight on to Cloudinary, so it never needs a file on the server
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 20 },
    fileFilter: (req, file, done) => {
        if (PHOTO_TYPES.includes(file.mimetype)) return done(null, true);
        done(fieldError(400, 'photo', 'Choose a JPEG, PNG or WebP photo.'));
    },
}).single('photo');

// Reads a form with one optional `photo` file: the file onto req.file, the text fields onto req.body.
// A request sent as JSON passes through untouched
export function photoUpload(req, res, next) {
    parsePhotoForm(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Choose a photo of 5 MB or less.'
                : 'Send one photo, in the photo field.';
            return next(fieldError(400, 'photo', message));
        }
        next(error);
    });
}
