import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { fetchCandyMachine, mplCandyMachine, mintV2 } from '@metaplex-foundation/mpl-candy-machine';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { generateSigner, publicKey, percentAmount, some } from '@metaplex-foundation/umi';
import { Connection, PublicKey, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TokenAccountNotFoundError, TokenInvalidAccountOwnerError } from '@solana/spl-token';
import { WalletTier, WalletTierInfo } from '../types/globals';
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import toast from 'react-hot-toast';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isMobile() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Helper pour convertir les instructions Solana en format UMI (exactement comme hashlips)
function toUmiInstruction(ix: any) {
  return {
    instruction: {
      programId: publicKey(ix.programId.toBase58()),
      keys: ix.keys.map((key: any) => ({
        pubkey: publicKey(key.pubkey.toBase58()),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: new Uint8Array(ix.data),
    },
    signers: [],
    bytesCreatedOnChain: 0,
  };
}

// Configuration des tiers basés sur la valeur USD avec numéros NFT
export const TIER_THRESHOLDS = {
  TOO_POOR: { min: 0, max: 10, nftRange: null },           // Moins de 10$ - pas de mint possible
  POOR: { min: 10, max: 1000, nftRange: [1, 100] },       // 10$ à 1000$ → NFT #1-100
  MID: { min: 1000, max: 10000, nftRange: [100, 200] },   // 1000$ à 10000$ → NFT #100-200
  RICH: { min: 10000, max: null, nftRange: [200, 300] }   // 10000$+ → NFT #200-300
} as const

// Token de la collection (devnet)
export const COLLECTION_TOKEN = "9JCdYQL53tH97ef7zZBTYWYtLAcWSQVMocs2AjqjD6a4"

// Helper for timeout
const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

// Récupère le prix SOL en USD via plusieurs oracles en parallèle (premier succès gagne)
export async function fetchSOLPriceUSD(): Promise<number> {
  const priceSources = [
    {
      name: 'CoinGecko',
      url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      parser: (data: any) => data?.solana?.usd
    },
    {
      name: 'CoinPaprika',
      url: 'https://api.coinpaprika.com/v1/tickers/sol-solana',
      parser: (data: any) => data?.quotes?.USD?.price
    },
    {
      name: 'CryptoCompare',
      url: 'https://min-api.cryptocompare.com/data/price?fsym=SOL&tsyms=USD',
      parser: (data: any) => data?.USD
    }
  ];

  // Attempt to fetch from a source with a timeout
  const fetchSource = async (source: any) => {
    try {
      const res = await Promise.race([
        fetch(source.url, { headers: { 'User-Agent': 'Oinkonomics/1.0' }, next: { revalidate: 60 } }),
        timeout(2000) // 2 second timeout per request
      ]) as Response;

      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const price = source.parser(data);
      if (typeof price === 'number' && price > 0) return price;
      throw new Error('Invalid price data');
    } catch (error) {
      throw new Error(`${source.name} failed: ${error}`);
    }
  };

  try {
    // Launch all fetches in parallel and take the first success
    // Promise.any is supported in Node 15+ (Next.js 14 uses recent Node)
    const price = await Promise.any(priceSources.map(s => fetchSource(s)));
    console.log(`✅ SOL price fetched fast: $${price.toFixed(2)}`);
    return price;
  } catch (aggregateError) {
    console.warn('⚠️ All price oracles failed or timed out:', aggregateError);
    return 0; // Fallback to 0 if everything fails
  }
}

export function getWalletTier(balanceSOL: number, solPriceUSD: number): WalletTierInfo {
  // Calculate value based on SOL only (this remains for backward compatibility)
  const balanceUSD = balanceSOL * (solPriceUSD || 0);

  // balance is expressed in SOL, balanceUSD added separately in the returned object
  if (balanceUSD < TIER_THRESHOLDS.TOO_POOR.max) {
    return {
      tier: 'TOO_POOR',
      balance: balanceSOL,
      balanceUSD,
      minThreshold: TIER_THRESHOLDS.TOO_POOR.min,
      maxThreshold: TIER_THRESHOLDS.TOO_POOR.max,
      nftRange: TIER_THRESHOLDS.TOO_POOR.nftRange
    }
  } else if (balanceUSD < TIER_THRESHOLDS.POOR.max) {
    const tier = 'POOR';
    return {
      tier,
      balance: balanceSOL,
      balanceUSD,
      minThreshold: TIER_THRESHOLDS.POOR.min,
      maxThreshold: TIER_THRESHOLDS.POOR.max,
      nftRange: TIER_THRESHOLDS.POOR.nftRange,
      nftNumber: generateNFTNumber(tier)
    }
  } else if (balanceUSD < TIER_THRESHOLDS.MID.max) {
    const tier = 'MID';
    return {
      tier,
      balance: balanceSOL,
      balanceUSD,
      minThreshold: TIER_THRESHOLDS.MID.min,
      maxThreshold: TIER_THRESHOLDS.MID.max,
      nftRange: TIER_THRESHOLDS.MID.nftRange,
      nftNumber: generateNFTNumber(tier)
    }
  } else {
    const tier = 'RICH';
    return {
      tier,
      balance: balanceSOL,
      balanceUSD,
      minThreshold: TIER_THRESHOLDS.RICH.min,
      maxThreshold: TIER_THRESHOLDS.RICH.max,
      nftRange: TIER_THRESHOLDS.RICH.nftRange,
      nftNumber: generateNFTNumber(tier)
    }
  }
}

// In-memory cache for wallet balances (in production, this would use Redis or similar)
const balanceCache = new Map<string, { balance: number, timestamp: number }>();
const tokenBalanceCache = new Map<string, { balance: number, timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds in milliseconds

// Function to get all token accounts for a wallet
async function getTokenAccounts(walletAddress: string, connection: Connection) {
  try {
    const publicKey = new PublicKey(walletAddress);
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    return tokenAccounts.value;
  } catch (error) {
    console.error('Erreur lors de la récupération des comptes token:', error);
    return [];
  }
}

// Function to get token price from CoinGecko (simplified - in production you'd want a comprehensive token list)
async function getTokenPriceUSD(mintAddress: string): Promise<number> {
  // For major tokens, we could map them to CoinGecko IDs
  // In a real implementation, you might want to use Jupiter, CoinGecko, or other price feeds
  const tokenPriceMap: Record<string, number> = {
    // USDC
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // Mainnet USDC
    '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 1, // Devnet USDC
    // USDT
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // Mainnet USDT
    // Other common tokens would go here
  };

  return tokenPriceMap[mintAddress] || 0; // Default to 0 if not found
}

// Function to get token balance and convert to USD value
export async function getTokenBalanceUSD(walletAddress: string): Promise<number> {
  // Check if token balance is in cache and not expired
  const cached = tokenBalanceCache.get(walletAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📈 Using cached token balance for ${walletAddress.substring(0, 8)}...`);
    return cached.balance;
  }

  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com'
    );

    const tokenAccounts = await getTokenAccounts(walletAddress, connection);
    let totalTokenValueUSD = 0;

    for (const tokenAccount of tokenAccounts) {
      try {
        const accountInfo = await connection.getParsedAccountInfo(tokenAccount.pubkey);
        if (!accountInfo.value) continue;

        const parsedData = accountInfo.value.data as any;
        if (!parsedData.parsed || !parsedData.parsed.info) continue;

        const tokenAmount = parsedData.parsed.info.tokenAmount;
        const mintAddress = parsedData.parsed.info.mint;

        // Get token amount in UI format
        const amount = parseFloat(tokenAmount.uiAmountString || '0');
        if (amount <= 0) continue; // Skip if no balance

        // Get token price in USD
        const tokenPriceUSD = await getTokenPriceUSD(mintAddress);
        const tokenValueUSD = amount * tokenPriceUSD;

        totalTokenValueUSD += tokenValueUSD;

        console.log(`Token ${mintAddress} balance: ${amount}, value: $${tokenValueUSD.toFixed(2)}`);
      } catch (error) {
        console.warn(`Could not process token account ${tokenAccount.pubkey.toBase58()}:`, error);
        continue; // Continue with other tokens
      }
    }

    // Cache the token balance value
    tokenBalanceCache.set(walletAddress, { balance: totalTokenValueUSD, timestamp: Date.now() });

    return totalTokenValueUSD;
  } catch (error) {
    console.error('Erreur lors de la récupération du solde token:', error);
    // If there's an error, try to return cached value if available (even if expired)
    if (cached) {
      console.log(`⚠️ Using expired cached token balance for ${walletAddress.substring(0, 8)}... due to error`);
      return cached.balance;
    }
    return 0; // Return 0 if there's an error and no cache
  }
}

export async function getWalletBalance(walletAddress: string): Promise<number> {
  // Check if balance is in cache and not expired
  const cached = balanceCache.get(walletAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📈 Using cached SOL balance for ${walletAddress.substring(0, 8)}...`);
    return cached.balance;
  }

  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com'
    );

    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const balanceInSOL = balance / LAMPORTS_PER_SOL; // Convert lamports to SOL

    // Cache the balance
    balanceCache.set(walletAddress, { balance: balanceInSOL, timestamp: Date.now() });

    return balanceInSOL;
  } catch (error) {
    console.error('Erreur lors de la récupération du solde:', error);
    // If there's an error, try to return cached value if available (even if expired)
    if (cached) {
      console.log(`⚠️ Using expired cached SOL balance for ${walletAddress.substring(0, 8)}... due to error`);
      return cached.balance;
    }
    throw new Error('Impossible de récupérer le solde du wallet');
  }
}

// Function to get total wallet value (SOL + tokens) in USD
export async function getTotalWalletValueUSD(walletAddress: string): Promise<number> {
  try {
    // Get SOL balance and convert to USD
    const solBalance = await getWalletBalance(walletAddress);
    const solPriceUSD = await fetchSOLPriceUSD();
    const solValueUSD = solBalance * solPriceUSD;

    // Get token balance in USD
    const tokenValueUSD = await getTokenBalanceUSD(walletAddress);

    // Return total value
    return solValueUSD + tokenValueUSD;
  } catch (error) {
    console.error('Erreur lors du calcul de la valeur totale du wallet:', error);
    // Return just SOL value if token fetching fails
    const solBalance = await getWalletBalance(walletAddress);
    const solPriceUSD = await fetchSOLPriceUSD();
    return solBalance * solPriceUSD;
  }
}

export async function verifyWalletTier(walletAddress: string): Promise<WalletTierInfo> {
  try {
    const totalValueUSD = await getTotalWalletValueUSD(walletAddress);
    const solPriceUSD = await fetchSOLPriceUSD();

    // Get SOL balance separately for the response
    const balanceSOL = await getWalletBalance(walletAddress);

    // Use the total wallet value in USD for tier determination
    return getWalletTierWithTotalValue(balanceSOL, solPriceUSD, totalValueUSD);
  } catch (error) {
    console.error('Erreur lors de la vérification du tier:', error);
    // Fallback to just SOL if token fetch fails
    const balanceSOL = await getWalletBalance(walletAddress);
    const solPriceUSD = await fetchSOLPriceUSD();
    return getWalletTier(balanceSOL, solPriceUSD);
  }
}

// New function to determine wallet tier based on total value (SOL + tokens)
export function getWalletTierWithTotalValue(balanceSOL: number, solPriceUSD: number, totalValueUSD: number): WalletTierInfo {
  // balance is expressed in SOL, totalValueUSD is the combined value of SOL + tokens
  if (totalValueUSD < TIER_THRESHOLDS.TOO_POOR.max) {
    return {
      tier: 'TOO_POOR',
      balance: balanceSOL,
      balanceUSD: totalValueUSD, // Use total value for tier calculation
      minThreshold: TIER_THRESHOLDS.TOO_POOR.min,
      maxThreshold: TIER_THRESHOLDS.TOO_POOR.max,
      nftRange: TIER_THRESHOLDS.TOO_POOR.nftRange
    }
  } else if (totalValueUSD < TIER_THRESHOLDS.POOR.max) {
    const tier = 'POOR';
    return {
      tier,
      balance: balanceSOL,
      balanceUSD: totalValueUSD, // Use total value for tier calculation
      minThreshold: TIER_THRESHOLDS.POOR.min,
      maxThreshold: TIER_THRESHOLDS.POOR.max,
      nftRange: TIER_THRESHOLDS.POOR.nftRange,
      nftNumber: generateNFTNumber(tier)
    }
  } else if (totalValueUSD < TIER_THRESHOLDS.MID.max) {
    const tier = 'MID';
    return {
      tier,
      balance: balanceSOL,
      balanceUSD: totalValueUSD, // Use total value for tier calculation
      minThreshold: TIER_THRESHOLDS.MID.min,
      maxThreshold: TIER_THRESHOLDS.MID.max,
      nftRange: TIER_THRESHOLDS.MID.nftRange,
      nftNumber: generateNFTNumber(tier)
    }
  } else {
    const tier = 'RICH';
    return {
      tier,
      balance: balanceSOL,
      balanceUSD: totalValueUSD, // Use total value for tier calculation
      minThreshold: TIER_THRESHOLDS.RICH.min,
      maxThreshold: TIER_THRESHOLDS.RICH.max,
      nftRange: TIER_THRESHOLDS.RICH.nftRange,
      nftNumber: generateNFTNumber(tier)
    }
  }
}

// In-memory tracking for minted NFT numbers by tier (in production, this would use a database)
const mintedNFTsByTier: Record<WalletTier, Set<number>> = {
  TOO_POOR: new Set(),
  POOR: new Set(),
  MID: new Set(),
  RICH: new Set()
};

export function generateNFTNumber(tier: WalletTier): number | null {
  const tierConfig = TIER_THRESHOLDS[tier];
  if (!tierConfig.nftRange) return null;

  const [min, max] = tierConfig.nftRange;
  const availableNumbers: number[] = [];

  // Find available numbers in the range
  for (let i = min; i <= max; i++) {
    if (!mintedNFTsByTier[tier].has(i)) {
      availableNumbers.push(i);
    }
  }

  // If all numbers are taken, return null
  if (availableNumbers.length === 0) {
    console.warn(`All NFT numbers in range [${min}, ${max}] for tier ${tier} have been minted`);
    return null;
  }

  // Pick a random available number
  const randomIndex = Math.floor(Math.random() * availableNumbers.length);
  const nftNumber = availableNumbers[randomIndex];

  // Mark this number as used
  mintedNFTsByTier[tier].add(nftNumber);

  return nftNumber;
}

// Function to track minted NFTs (would be called after a successful mint)
export function trackMintedNFT(tier: WalletTier, nftNumber: number) {
  mintedNFTsByTier[tier].add(nftNumber);
}

export function getNFTRangeForTier(tier: WalletTier): string {
  const tierConfig = TIER_THRESHOLDS[tier];
  if (!tierConfig.nftRange) return "Aucun NFT disponible";

  const [min, max] = tierConfig.nftRange;
  return `NFT #${min}-${max}`;
}

export const createUmiInstance = (wallet: WalletAdapter) => {
  const umi = createUmi(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com');
  return umi
    .use(walletAdapterIdentity(wallet))
    .use(mplCandyMachine());
};

export const mintNFT = async (wallet: WalletAdapter, candyMachineId: string) => {
  try {
    console.log('🎯 MINT RÉEL depuis Candy Machine Oinkonomics...', { candyMachineId });

    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet non connecté');
    }

    // Vérifier que c'est bien la vraie Candy Machine Oinkonomics
    // In a real implementation, you'd have different CM IDs for each tier
    // For now, validating the single CM ID we have
    const validCandyMachineIds = [
      "8HTSVL3fNTg8CugR8veRGVEyLhz5CBbkW2T4m54zdTAn"  // Oinkonomics main CM
      // In the future, you could add different IDs for different tiers:
      // "CANDY_MACHINE_ID_POOR",  // For POOR tier
      // "CANDY_MACHINE_ID_MID",   // For MID tier
      // "CANDY_MACHINE_ID_RICH"   // For RICH tier
    ];

    if (!validCandyMachineIds.includes(candyMachineId)) {
      throw new Error('ID de Candy Machine invalide. Utilisez une collection Oinkonomics autorisée !');
    }

    console.log('✅ Mint depuis la VRAIE collection Oinkonomics déployée sur devnet...');

    // Initialiser UMI avec wallet adapter
    const umi = createUmiInstance(wallet);

    // Générer le mint signer pour le nouveau NFT
    const nftMint = generateSigner(umi);

    console.log('🎯 NFT Mint généré:', nftMint.publicKey.toString());

    // mintV2 est importé en haut du fichier

    // Informations de la Candy Machine Oinkonomics depuis hashlips/cache.json
    const candyMachine = publicKey(candyMachineId);
    const candyGuard = publicKey("6BBpt7rcWNy6u5ApCpykgpvRV7Vv49JgfAcGxWoUCA9v");
    const collectionMint = publicKey("9JCdYQL53tH97ef7zZBTYWYtLAcWSQVMocs2AjqjD6a4");

    // Récupérer la VRAIE collection update authority depuis la blockchain (comme dans hashlips)
    // CORRECTION : L'autorité réelle est FFTLr4uWg5HdYpvgtEnxtzMQWHEoFjWVWiPQZ7Wxvsfm !
    let collectionUpdateAuthorityStr = "FFTLr4uWg5HdYpvgtEnxtzMQWHEoFjWVWiPQZ7Wxvsfm"; // VRAIE autorité

    try {
      const { fetchDigitalAsset } = await import('@metaplex-foundation/mpl-token-metadata');
      const asset = await fetchDigitalAsset(umi, collectionMint);
      const onChainAuthority = asset.metadata.updateAuthority;

      if (onChainAuthority && onChainAuthority.toString() !== collectionUpdateAuthorityStr) {
        console.log('🔄 Utilisation de l\'update authority on-chain:', onChainAuthority.toString());
        collectionUpdateAuthorityStr = onChainAuthority.toString();
      }
    } catch (error) {
      console.warn('⚠️ Impossible de vérifier la collection, utilisation du cache:', error);
    }

    const collectionUpdateAuthority = publicKey(collectionUpdateAuthorityStr);

    console.log('🔧 Configuration Candy Machine (EXACTE hashlips):', {
      candyMachine: candyMachine.toString(),
      candyGuard: candyGuard.toString(),
      collectionMint: collectionMint.toString(),
      collectionUpdateAuthority: collectionUpdateAuthority.toString(),
      nftMint: nftMint.publicKey.toString()
    });

    // Ajouter compute budget instructions (ESSENTIEL pour éviter "exceeded CUs meter")
    const computeUnits = 400000; // Même valeur que hashlips/.env
    const priorityMicrolamports = 0; // Même valeur que hashlips/.env

    const extras = [];
    if (computeUnits > 0) {
      extras.push(toUmiInstruction(ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits })));
    }
    if (priorityMicrolamports > 0) {
      extras.push(toUmiInstruction(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityMicrolamports })));
    }

    // Paramètres mint EXACTEMENT comme hashlips réussi
    const params = {
      candyMachine,
      candyGuard,
      nftMint,
      collectionMint,
      collectionUpdateAuthority, // ✅ Autorité RÉELLE : FFTLr4uWg5HdYpvgtEnxtzMQWHEoFjWVWiPQZ7Wxvsfm
      mintArgs: {
        solPayment: some({
          destination: publicKey("5zHBXzhaqKXJRMd7KkuWsb4s8zPyakKdijr9E3jgyG8Z")
        })
      }
    };

    // Builder avec compute budget (exactement comme hashlips)
    const builder = mintV2(umi, params);
    const fullBuilder = extras.length ? builder.prepend(extras) : builder;

    // Exécuter le mint avec compute budget
    const { signature } = await fullBuilder.sendAndConfirm(umi);
    const mintResult = { signature };

    console.log('✅ NFT Oinkonomics RÉEL minté avec succès !', {
      signature: mintResult.signature.toString(),
      mint: nftMint.publicKey.toString()
    });

    // Récupérer les métadonnées pour afficher le nom/numéro
    let nftName = 'Oinkonomics NFT';
    try {
      const { fetchMetadata } = await import('@metaplex-foundation/mpl-token-metadata');
      const metadata = await fetchMetadata(umi, nftMint.publicKey);
      nftName = metadata.name;
    } catch (metaError) {
      console.warn('⚠️ Impossible de récupérer les métadonnées:', metaError);
    }

    return {
      success: true,
      signature: mintResult.signature.toString(),
      mint: nftMint.publicKey.toString(),
      message: `🎉 ${nftName} minté avec succès ! Mint: ${nftMint.publicKey.toString().substring(0, 8)}...`
    };

  } catch (error) {
    console.error('❌ Erreur de mint Candy Machine:', error);

    // Messages d'erreur plus spécifiques aux guards Oinkonomics
    let errorMessage = 'Erreur inconnue lors du mint';
    if (error instanceof Error) {
      if (error.message.includes('insufficient') || error.message.includes('lamports')) {
        errorMessage = '💰 Solde insuffisant ! Vous avez besoin de ~0.011 SOL pour minter (0.01 + frais réseau)';
      } else if (error.message.includes('guard') || error.message.includes('sol_payment')) {
        errorMessage = '🚫 Paiement requis : 0.01 SOL. Vérifiez votre solde devnet !';
      } else if (error.message.includes('sold out') || error.message.includes('empty')) {
        errorMessage = '😱 Collection épuisée ! Plus de NFTs disponibles dans cette Candy Machine';
      } else if (error.message.includes('freeze')) {
        errorMessage = '🧊 Problème avec le freeze guard - contactez le support';
      } else {
        errorMessage = `🔥 Erreur blockchain: ${error.message}`;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};
