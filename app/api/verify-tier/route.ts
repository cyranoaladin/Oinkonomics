import { NextRequest, NextResponse } from 'next/server';
import { verifyWalletTier } from '../../../lib/utils';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Create a rate limiter: max 10 requests per minute per IP
const limiter = new RateLimiterMemory({
  points: 10, // Number of points
  duration: 60, // Per 60 seconds
});

// Handle preflight OPTIONS requests
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  // Set CORS headers for the main request
  const response = new NextResponse();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    // Get the client IP address for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||

      '127.0.0.1';

    // Consume a point from the rate limiter
    try {
      await limiter.consume(ip);
    } catch (rejRes) {
      // If rate limit is exceeded, return 429 status
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // Basic validation of wallet address format
    if (typeof walletAddress !== 'string' || walletAddress.length < 32 || walletAddress.length > 44) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const tierInfo = await verifyWalletTier(walletAddress);

    return NextResponse.json({
      walletAddress,
      tier: tierInfo.tier,
      balance: Math.round(tierInfo.balance * 1000000) / 1000000, // SOL with micro precision
      balanceUSD: Math.round((tierInfo.balanceUSD ?? 0) * 100) / 100,
      minThreshold: tierInfo.minThreshold,
      maxThreshold: tierInfo.maxThreshold,
      nftRange: tierInfo.nftRange,
      nftNumber: tierInfo.nftNumber,
      verified: true,
      message: getTierMessage(tierInfo.tier, tierInfo.nftNumber ?? null)
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error('❌ Erreur API verify-tier:', error);
    return NextResponse.json(
      { error: 'Verification failed: ' + (error as Error).message },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

function getTierMessage(tier: string, nftNumber: number | null): string {
  switch (tier) {
    case 'Oinkless':
      return "😱 You need at least $10 to mint! Come back when you're less Oinkless!";
    case 'Oinklings':
      return "🥉 Oinkling Tier - You can mint NFT #" + nftNumber + " (Range: #1-100)";
    case 'Midings':
      return "🥈 Miding Tier - You can mint NFT #" + nftNumber + " (Range: #100-200)";
    case 'Oinklords':
      return "🥇 Oinklord Tier - You can mint NFT #" + nftNumber + " (Range: #200-300)";
    default:
      return 'Unknown tier';
  }
}
