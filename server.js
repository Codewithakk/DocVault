import http from "http";
import app from "./src/app.js";
import logger from "./src/utils/logger.js";
import { API_CONFIG } from "./src/config/ApiEndpoints.js";

const PORT = API_CONFIG.PORT || 5000;

const server = http.createServer(app);
server.listen(PORT, () => logger.info(`Server running on http://localhost:${PORT}`));

const gracefulShutdown = () => {
    logger.info("Received kill signal, shutting down gracefully");
    server.close(() => {
        logger.info("Closed out remaining connections");
        process.exit(0);
    });

    setTimeout(() => {
        logger.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

process.on("unhandledRejection", (err) => {
    logger.error("Unhandled Promise Rejection:", err);
});

process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception:", err);
    process.exit(1);
});
