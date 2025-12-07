import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { setNonceCookie } from '@/lib/server/auth';

export async function GET() {
    // Generate a random nonce
    const nonce = crypto.randomBytes(16).toString('hex');

    // Securely store the nonce in an HTTP-only cookie (Stateless verification)
    setNonceCookie(nonce);

    // Construct the message to sign
    const message = `Verify Oinkonomics Ownership\n\nNonce: ${nonce}`;

    return NextResponse.json({ nonce, message });
}
