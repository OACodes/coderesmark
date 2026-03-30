import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const {
    PORT,
    NODE_ENV,
    MONGO_URI,
    REDIS_URL,
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRY,
    JWT_REFRESH_EXPIRY,
    OPENAI_API_KEY
} = process.env;