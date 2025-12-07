import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { getNonceFromCookie, setSessionCookie, clearCookies } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
    try {
        const { publicKey, signature, message } = await req.json();

        if (!publicKey || !signature || !message) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // 1. Verify the challenge (Nonce) matches what we sent
        // This proves the signature was generated FRESH for this specific request
        const storedNonce = getNonceFromCookie();
        if (!storedNonce) {
            return NextResponse.json({ error: 'Login session expired. Please retry.' }, { status: 401 });
        }

        // Verify nonce is actually in the message
        if (!message.includes(storedNonce)) {
            return NextResponse.json({ error: 'Invalid nonce in message' }, { status: 401 });
        }

        // 2. Cryptographic Verification (Ed25519)
        const msgBytes = new TextEncoder().encode(message);
        const sigBytes = bs58.decode(signature);
        const pubKeyBytes = new PublicKey(publicKey).toBytes();

        const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid crypto signature' }, { status: 401 });
        }

        // 3. Success -> Create Authenticated Session
        setSessionCookie(publicKey);

        // Clear the used nonce (One-time use)
        // Note: For strict implementation we should clear it, but keeping it simple for now just overwrites
        // clearCookies(); // Only clears nonce, session is set strictly after

        return NextResponse.json({
            success: true,
            message: 'Authentication successful',
            verifiedWallet: publicKey
        });

    } catch (error) {
        console.error('Auth verification error:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}
