import crypto from 'crypto';
import { API_CONFIG } from '../config/ApiEndpoints.js';

const ENCRYPTION_KEY = Buffer.from(API_CONFIG.encryptedKey, 'utf8'); // 32 bytes for AES-256
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // shorter, secure for GCM


function base64UrlEncode(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(str) {
    str = str
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    // Pad string to multiple of 4
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64');
}


export function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return base64UrlEncode(Buffer.concat([iv, tag, encrypted]));
}

export function decrypt(data) {
    const buffer = base64UrlDecode(data);
    const iv = buffer.slice(0, IV_LENGTH);
    const tag = buffer.slice(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = buffer.slice(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(ALGO, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
}



