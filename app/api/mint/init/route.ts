import { NextRequest, NextResponse } from 'next/server';
import { getSessionWallet } from '@/lib/server/auth';
import { verifyWalletTier } from '@/lib/utils';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
    publicKey,
    generateSigner,
    signerIdentity,
    createSignerFromKeypair,
    createNoopSigner,
    transactionBuilder,
    some,
    sol
} from '@metaplex-foundation/umi';
import {
    mplCandyMachine,
    mintV2,
    fetchCandyMachine
} from '@metaplex-foundation/mpl-candy-machine';
import {
    setComputeUnitLimit,
    setComputeUnitPrice
} from '@metaplex-foundation/mpl-toolbox';
import { base64 } from '@metaplex-foundation/umi/serializers';

// Environment & Constants
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const CANDY_MACHINE_ID = publicKey(
    process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!
);
const CANDY_GUARD_ID = publicKey(
    process.env.NEXT_PUBLIC_CANDY_GUARD_ID!
);
const COLLECTION_MINT = publicKey(
    process.env.NEXT_PUBLIC_COLLECTION_MINT!
);
const COLLECTION_AUTHORITY = publicKey(
    process.env.NEXT_PUBLIC_COLLECTION_AUTHORITY!
);
const PAYMENT_DESTINATION = publicKey(
    process.env.NEXT_PUBLIC_PAYMENT_DESTINATION!
);

export async function POST(req: NextRequest) {
    try {
        // 1. Authentication
        const userWalletStr = getSessionWallet();
        if (!userWalletStr) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = publicKey(userWalletStr);

        // 2. Validate Tier (Server Side)
        // Ensure user is allowed to mint specific tiers (for now allowing all non-Oinkless)
        const tierInfo = await verifyWalletTier(userWalletStr);
        if (tierInfo.tier === 'Oinkless') {
            return NextResponse.json({ error: 'Tier Oinkless cannot mint.' }, { status: 403 });
        }

        // 3. Initialize Server Umi
        const umi = createUmi(RPC_ENDPOINT).use(mplCandyMachine());

        // We need to set a "dummy" identity just so Umi doesn't complain about missing signer 
        // when we build, although we will explicitly set feePayer to user.
        // We'll generate a disposable keypair for the "Backend Operator" if we needed to sign anything backend-side
        // But here we just need to facilitate the transaction building.
        // Using a generated signer as identity is safe as it won't be paying fees.
        const backendSigner = generateSigner(umi);
        umi.use(signerIdentity(backendSigner));

        // 4. Generate the NFT Mint Keypair (The generic "Art" container)
        // Ideally this is done on server so we can track it or ensure randomness
        const nftMint = generateSigner(umi);

        // 5. Build Transaction
        // Security Note: We are constructing the instruction for the USER to sign.
        // We are NOT signing for the user.

        // Compute Budget (Essential)
        const computeLimit = setComputeUnitLimit(umi, { units: 400000 });
        const computePrice = setComputeUnitPrice(umi, { microLamports: 0 });

        // Create a No-Op Signer for the user (since we don't have their secret key)
        // This satisfies Umi's type checking for the builder
        const minterSigner = createNoopSigner(user);

        // Mint Instruction
        const mintIx = mintV2(umi, {
            candyMachine: CANDY_MACHINE_ID,
            candyGuard: CANDY_GUARD_ID,
            nftMint: nftMint,
            collectionMint: COLLECTION_MINT,
            collectionUpdateAuthority: COLLECTION_AUTHORITY,
            minter: minterSigner, // The user is the one minting
            mintArgs: {
                solPayment: some({
                    destination: PAYMENT_DESTINATION
                })
            }
        });

        // Assemble
        // setFeePayer(user) ensures the resulting transaction expects the user's signature at position 0
        let builder = transactionBuilder()
            .add(computeLimit)
            .add(computePrice)
            .add(mintIx)
            .setFeePayer(minterSigner);

        // 6. Build and Partially Sign (Server signs the NFT Mint Keypair)
        // We use buildAndSign but we only provide the [nftMint] signer.
        // Umi allows us to pass signers. The 'user' signer is missing, so this function would strictly fail 
        // if we tried to submit it. But we just want to build and serialize.
        // ACTUALLY: Umi's buildAndSign tries to resolve all signers.
        // If 'user' is listed as a signer (which it is, as minter/payer), and we don't have its secret key,
        // Umi will throw "Signer not found" or "Cannot sign".

        // Correction: We must purely BUILD the transaction with `build()` which returns a `Transaction` object.
        // Then we manually verify/add the `nftMint` signature if Umi's serializer supports it.
        // OR simpler: We allow the client to sign both. 
        // BUT: The `nftMint` is a Keypair. If we send just the Public Key to client, client can't sign for it.
        // SO: We must pass the Secret Key of the Mint to the client? Risk of interception?
        // No, Mint keypair is disposable and belongs to the user strictly. Sending the generated keypair to client is standard
        // for "Candy Machine JS SDK" flow, but here we want "Server Side Init".

        // Optimal Secure Flow:
        // 1. Build transaction.
        // 2. Sign with `nftMint` (backend has the key).
        // 3. Serialize the transaction (which now has 1 valid signature + 1 empty slot for User).
        // 4. Send base64 to client.
        // 5. Client Wallet (Phantom) sees "1 of 2 signatures present", adds theirs, and sends.

        // Impl:
        const transaction = await builder.build(umi);

        // We sign with the Mint Keypair
        // Umi's `umi.rpc.signTransaction` or equivalent transformer?
        // Umi transaction structure is complex (VersionedTransaction).
        // Simplest way with Umi:
        // use `builder.setAddress(nftMint.publicKey)`? No.

        // Let's use the standard flow: pass the keypair to the client vs partial sign.
        // Partial sign is better UX (User just approves).
        // Umi's `signTransaction` function:
        const signedTx = await umi.identity.signTransaction(transaction);
        // Wait, umi.identity is random. We need to sign with nftMint.
        const nftSigner = createSignerFromKeypair(umi, nftMint);
        const partiallySignedTx = await nftSigner.signTransaction(transaction);

        // Serialization
        // Umi's serializer
        const serializedTx = umi.transactions.serialize(partiallySignedTx);
        const base64Tx = base64.deserialize(serializedTx)[0]; // Bytes -> Base64 String

        return NextResponse.json({
            success: true,
            transaction: base64Tx,
            mint: nftMint.publicKey.toString(),
            message: 'Transaction initialized. Please sign in wallet.'
        });

    } catch (error) {
        console.error('Mint Init Error:', error);
        return NextResponse.json(
            { error: 'Failed to initialize mint', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
