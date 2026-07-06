// Global notification utility

export function notifyAll(io, message, type = "info", extra = {}) {
    io.emit("notification", {
        message,
        type,
        timestamp: new Date(),
        ...extra,
    });
}

export function notifyUser(io, userId, message, type = "info", extra = {}) {
    io.to(userId).emit("notification", {
        message,
        type,
        timestamp: new Date(),
        ...extra,
    });
}
