import 'dotenv/config';

// Every setting the app reads, in one place
export const {
    PORT = '5600',
    NODE_ENV = 'development',
    ARCJET_KEY,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
} = process.env;
