import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    // Generate a random nonce
    const nonce = crypto.randomBytes(16).toString('hex');

    // Construct the message to sign
    // Including the nonce prevents replay attacks
    const message = `Verify Oinkonomics Ownership\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

    // In a real production app with a database, you should save this nonce 
    // linked to the session or wallet to verify it hasn't been used before.
    // For this stateless verifiable credential, we return it to the client 
    // to include in the signed payload.

    return NextResponse.json({ nonce, message });
}
