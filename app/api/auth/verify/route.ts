import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

export async function POST(req: NextRequest) {
    try {
        const { publicKey, signature, nonce, message } = await req.json();

        if (!publicKey || !signature || !message) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Convert inputs to Uint8Array for tweetnacl
        const msgBytes = new TextEncoder().encode(message);
        const sigBytes = bs58.decode(signature);
        const pubKeyBytes = new PublicKey(publicKey).toBytes();

        // Verify the signature
        // nacl.sign.detached.verify returns true if the signature is valid for the message and public key
        const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid crypto signature' }, { status: 401 });
        }

        // In a real app, you would now create a session cookie or JWT
        // const token = createSession(publicKey);

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
