import crypto from 'crypto';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-prod-oinkonomics';

// Cookie Constants
export const COOKIE_NONCE_NAME = 'oink_auth_nonce';
export const COOKIE_SESSION_NAME = 'oink_auth_session';

// 5 minutes expiration for nonce (Login window)
const NONCE_AGE = 60 * 5;
// 24 hours expiration for session
const SESSION_AGE = 60 * 60 * 24;

/**
 * Signs data using HMAC SHA-256
 */
function sign(data: string): string {
    return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
}

/**
 * Verify signed data (format: value.signature)
 */
function verify(signedData: string): string | null {
    const [value, signature] = signedData.split('.');
    if (!value || !signature) return null;

    const expectedSignature = sign(value);
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return value;
    }
    return null;
}

export function setNonceCookie(nonce: string) {
    const signedNonce = `${nonce}.${sign(nonce)}`;
    cookies().set(COOKIE_NONCE_NAME, signedNonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: NONCE_AGE,
        path: '/',
    });
}

export function getNonceFromCookie(): string | null {
    const cookie = cookies().get(COOKIE_NONCE_NAME);
    if (!cookie?.value) return null;
    return verify(cookie.value);
}

export function setSessionCookie(walletAddress: string) {
    // Simple session: walletAddress.signature
    // In production could be a full JWT
    const payload = JSON.stringify({ wallet: walletAddress, iat: Date.now() });
    const signedSession = `${Buffer.from(payload).toString('base64')}.${sign(payload)}`;

    cookies().set(COOKIE_SESSION_NAME, signedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_AGE,
        path: '/',
    });
}

export function getSessionWallet(): string | null {
    const cookie = cookies().get(COOKIE_SESSION_NAME);
    if (!cookie?.value) return null;

    const parts = cookie.value.split('.');
    if (parts.length !== 2) return null;

    const [b64Payload, signature] = parts;
    const payloadStr = Buffer.from(b64Payload, 'base64').toString();

    const expectedSig = sign(payloadStr);
    if (signature !== expectedSig) return null;

    try {
        const payload = JSON.parse(payloadStr);
        return payload.wallet;
    } catch {
        return null;
    }
}

export function clearCookies() {
    cookies().delete(COOKIE_NONCE_NAME);
    cookies().delete(COOKIE_SESSION_NAME);
}
