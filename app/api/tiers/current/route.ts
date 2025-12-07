import { NextResponse } from 'next/server';
import { getSessionWallet } from '@/lib/server/auth';
import { verifyWalletTier } from '@/lib/utils'; // Reusing the robust logic we already have

export const dynamic = 'force-dynamic'; // No caching, real-time wealth check

export async function GET() {
    try {
        // 1. Secure Session Check (Anti-Spoofing)
        const walletAddress = getSessionWallet();

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Unauthorized. Please sign in.' },
                { status: 401 }
            );
        }

        console.log(`🔍 Calculating Verified Tier for: ${walletAddress}`);

        // 2. Server-Side Calculation (Trusted)
        // This re-uses our existing robust logic (SOL + Tokens + Price Feed)
        // But running it on the server prevents client-side manipulation
        const tierData = await verifyWalletTier(walletAddress);

        console.log(`✅ Tier Calculated: ${tierData.tier} ($${tierData.balanceUSD.toFixed(2)})`);

        return NextResponse.json({
            success: true,
            data: tierData,
            wallet: walletAddress
        });

    } catch (error) {
        console.error('Tier calculation error:', error);
        return NextResponse.json(
            { error: 'Failed to calculate tier', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
