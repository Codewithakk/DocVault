import { createLogger, format, transports } from "winston";
import path from "path";
import fs from "fs";

const { combine, timestamp, printf, colorize, errors } = format;

// Log folder at project root
const logDir = path.resolve(process.cwd(), "logs");

// Create folder if it doesn't exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

// Winston logger
const logger = createLogger({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        logFormat
    ),
    transports: [
        new transports.Console(), // logs to console
        new transports.File({ filename: path.join(logDir, "Error.log"), level: "error" }),
        new transports.File({ filename: path.join(logDir, "Warn.log"), level: "warn" }),
        new transports.File({ filename: path.join(logDir, "combined.log") }),
        // new transports.File({ filename: path.join(logDir, "debug.log"), level: "debug" }),
        new transports.File({ filename: path.join(logDir, "Access.log"), level: "info" }),
    ],
    exitOnError: false,
});

export default logger;
