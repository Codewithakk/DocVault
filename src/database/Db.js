import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { setServers } from "node:dns/promises";
setServers(["1.1.1.1", "8.8.8.8"]);

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info('Connected to MongoDB');
    } catch (err) {
        logger.error('MongoDB connection error:', err);
        process.exit(1);
    }
};
