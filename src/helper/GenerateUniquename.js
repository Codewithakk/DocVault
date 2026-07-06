import path from 'path'
import crypto from 'crypto'
import { encrypt } from './SymmetricEncryption.js';
// export function generateUniqueFileName(originalName) {
//     const ext = path.extname(originalName);
//     const base = path.basename(originalName, ext);
//     const id = crypto.randomBytes(8).toString("hex");
//     return `${base}_${id}${ext}`;
// }

export function generateShareLink(documentId, fileId, version) {
    const payload = JSON.stringify({ id: documentId, fileId, version });
    const token = encrypt(payload);
    return `${process.env.BASE_URL || 'http://localhost:5000'}/documents/view?token=${encodeURIComponent(token)}`;
}

// utils/fileUtils.js
export const generateUniqueFileName = (originalName) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));

    return `${nameWithoutExt}_${timestamp}_${randomString}.${extension}`;
};

export const getFileSize = (buffer) => {
    return buffer.length; // in bytes
};