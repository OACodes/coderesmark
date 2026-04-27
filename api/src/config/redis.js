import Redis from 'ioredis';
import { REDIS_URL } from './env.js';

const client = new Redis(REDIS_URL);

client.on('error', (err) => console.error('Redis Client Error: ', err));
client.on('connect', () => console.log('✅ Redis Connected'));

export default client;