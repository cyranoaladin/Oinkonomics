# Mobile Wallet Connection & Tier-Based Minting – Technical Spec

Last updated: 2025-12-08  
Target stack: Next.js 14 (App Router), TypeScript, `@solana/wallet-adapter-react`, Solana Mobile Wallet Adapter, WalletConnect v2, Umi + Candy Machine v3, Solana devnet / mainnet-beta.

---

## 1. Context

Oinkonomics is a Solana dApp that:

- lets users **connect their Solana wallet** (mobile & desktop),
- computes a **Wealth Tier** from their on-chain portfolio,
- and allows them to **mint a free NFT** from a Candy Machine, with the tier encoded in the metadata / selection range. :contentReference[oaicite:0]{index=0}  

The **current implementation** already contains:

- A **wallet context** using:
  - `ConnectionProvider`, `WalletProvider`, `WalletModalProvider`,
  - **Solana Mobile Wallet Adapter** on mobile,
  - **WalletConnectWalletAdapter** with `WALLETCONNECT_PROJECT_ID` and `WALLETCONNECT_RELAY_URL`. :contentReference[oaicite:1]{index=1}  
- A `WalletConnect` button component that wraps `WalletMultiButton` and defines deep-links for Phantom / Solflare / Trust / Backpack / Glow as emergency fallback. :contentReference[oaicite:2]{index=2}  
- A **secure login flow** in `components/VerifyMint.tsx`:
  1. `GET /api/auth/nonce` → server sets a signed nonce cookie (`oink_auth_nonce`).
  2. Wallet **signs a message** containing the nonce.
  3. `POST /api/auth/verify` verifies the Ed25519 signature (tweetnacl + bs58), and sets a signed `oink_auth_session` cookie containing the wallet address. :contentReference[oaicite:3]{index=3}  
  4. `GET /api/tiers/current` recomputes the tier **server-side** from the session wallet address, using `verifyWalletTier` in `lib/utils`. :contentReference[oaicite:4]{index=4}  
- A **mint init** endpoint:  
  `POST /api/mint/init` builds a Candy Machine mint transaction with Umi, **partially signs it server-side with the mint keypair**, serializes it to base64 and returns it to the client. The client deserializes it as a `VersionedTransaction`, signs and sends it. :contentReference[oaicite:5]{index=5}  

The **tier system** is currently:

- `Oinkless`: `< $10` – **no mint**
- `Oinklings`: `$10 – $1,000` → NFT range `[1, 100]`
- `Midings`: `$1,000 – $10,000` → NFT range `[100, 200]`
- `Oinklords`: `$10,000+` → NFT range `[200, 300]`

implemented as `TIER_THRESHOLDS` in `lib/utils.ts`, using SOL balance * SOL price + basic token valuation (USDC, etc.). :contentReference[oaicite:6]{index=6}  

### Pain points (mobile)

From the previous audit and current code:

1. **Read-only connection** (historical):  
   - The landing page (`app/page.tsx`) initially relied on `publicKey` only, without any cryptographic proof of ownership. The new `VerifyMint` flow fixes this by forcing a **signMessage**. :contentReference[oaicite:7]{index=7}  

2. **WalletConnect / Trust Wallet issues**:  
   - Mobile connection via WalletConnect fails or falls back to Trust Wallet’s internal browser if the **WalletConnect project ID is invalid or missing**.  
   - The code uses `WALLETCONNECT_PROJECT_ID` from `constants/solana.ts`, but in production this must be a **valid WalletConnect Cloud project** configured in Vercel env. :contentReference[oaicite:8]{index=8}  

3. **Network mismatch issues (devnet vs mainnet)**:  
   - `SOLANA_NETWORK` is computed from `NEXT_PUBLIC_SOLANA_TESTNET` (`Mainnet` when `'false'`, otherwise `Devnet`),  
   - while RPC URLs (`NEXT_PUBLIC_RPC_URL`), Candy Machine ID, Candy Guard ID and collection mint in `/api/mint/init` are **hard-coded devnet constants**.  
   - Any mismatch (e.g. MWA on devnet + RPC mainnet, or inverse) breaks mobile connections or mint. :contentReference[oaicite:9]{index=9}  

4. **UX not fully aligned** with the desired story:
   - The main page still has a `Scan` flow (`handleScan` in `app/page.tsx`) calling `/api/verify-tier` directly, in parallel to the **new secure login flow** in `VerifyMint.tsx`.  
   - On mobile, the user must see a clear flow:  
     **Connect → Approve connection → Sign login message → See tier → Mint NFT**.

---

## 2. Requirements

### 2.1 Functional Requirements

1. **Wallet detection & connection (mobile-first)**  
   - When the user taps the **single Connect button**:
     - On **mobile**, the app must:
       - detect it is on iOS / Android,
       - offer wallets via **Solana Mobile Wallet Adapter** (MWA) and **WalletConnect** only,
       - show the native system sheet / wallet selector (e.g. Phantom, Solflare, Trust, Backpack, Glow).
     - On **desktop**, the app must:
       - still support injected wallets and QR / WalletConnect,
       - use `WalletMultiButton` as the universal entry point.

2. **Explicit “accept connection / sign in” step**  
   - After connection, a **"Verify my Oinks"** (or similar) CTA must:
     - trigger `signMessage` on the selected wallet,
     - show a clear message like:  
       `"Verify Oinkonomics Ownership\n\nNonce: <nonce>"`,
     - only then mark the user as “logged in” by setting the `oink_auth_session` cookie.

3. **Tier computation & display**  
   - Once authenticated, `/api/tiers/current` must:
     - read the session wallet,
     - compute the tier using `verifyWalletTier` (SOL + token balances + SOL price),
     - return a normalized payload with:
       - `tier`, `balance`, `balanceUSD`, `minThreshold`, `maxThreshold`,
       - `nftRange`, `nftNumber`,
       - a human-readable `message`.
   - The UI must display:
     - the tier label,
     - the USD value,
     - the NFT range & selected NFT number,
     - a “NO MINT” state for `Oinkless`.

4. **Tier-based NFT minting**  
   - From the verified state, the user clicks **“Mint my NFT”**:
     - the client calls `POST /api/mint/init`,
     - the server builds & **partially signs** a Candy Machine mint transaction,
     - returns the base64-encoded transaction,
     - the wallet signs and sends the transaction,
     - on success, the app confirms mint and may show the signature / minted mint address.
   - `Oinkless` wallets **must not be allowed** to mint (server-side clean 403).

5. **Network profiles (devnet / mainnet)**  
   - The application must support two coherent profiles:
     - **DEVNET** (default during hackathon / testing)
       - `SOLANA_NETWORK = Devnet`
       - `SOLANA_RPC_ENDPOINT = devnet URL`
       - Candy Machine, Candy Guard, collection mint = devnet addresses
     - **MAINNET-BETA** (later production)
       - `SOLANA_NETWORK = Mainnet`
       - `SOLANA_RPC_ENDPOINT = mainnet URL (Helius / QuickNode / etc.)`
       - Candy Machine, Candy Guard, collection mint = mainnet addresses
   - For a given deployment, **all three** must be aligned:
     - Wallet adapters’ `network`,
     - RPC endpoint used by Umi & `Connection`,
     - on-chain addresses (Candy Machine, Candy Guard, Collection mint).

6. **Rate limiting & robustness**  
   - `POST /api/verify-tier` and `GET /api/tiers/current` stay rate-limited (already implemented via `rate-limiter-flexible`) to avoid abuse. :contentReference[oaicite:10]{index=10}  

### 2.2 Non-Functional Requirements

1. **Security**
   - Never trust client-side balances; all tier logic must be computed server-side.
   - The signature flow (`/api/auth/nonce` → `/api/auth/verify`) must:
     - use signed HTTP-only cookies (HMAC with `JWT_SECRET` already implemented),
     - validate the nonce is present in the message,
     - validate Ed25519 signature using wallet public key.
   - `JWT_SECRET` must be set in production (.env + Vercel secrets).

2. **UX**
   - One **single obvious button** to connect (Header).
   - A clear step-by-step story:
     1. “Connect wallet”
     2. “Verify my Oinks” (sign message)
     3. See tier card
     4. “Mint NFT”
   - Error messages must be explicit:
     - network errors, WalletConnect errors, user rejection, offline state.

3. **Compatibility**
   - Tested wallets:
     - Phantom, Solflare, Backpack, Glow, Trust Wallet.
   - Browsers:
     - Safari iOS, Chrome Android, Chrome / Brave desktop.

4. **Observability**
   - Console logs already present on server should be kept but possibly refined:
     - log wallet, selected tier, RPC endpoint and cluster,
     - log mint transaction signature and errors.

---

## 3. Implementation Plan

This section can be used as a list of GitHub / Linear tickets.

### 3.1 Environment & Network Alignment

**MOB-01 – Define environment variables & profiles**

- Add a doc `docs/env-config.md` describing:

  - `NEXT_PUBLIC_SOLANA_TESTNET`  
    - `'false'` → mainnet-beta  
    - anything else / unset → devnet  
  - `NEXT_PUBLIC_RPC_URL`  
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`  
  - `JWT_SECRET`  

- Add a `.env.example` file with sensible defaults (devnet).

**MOB-02 – Align `constants/solana.ts` with profiles**

- Current file: `constants/solana.ts` computes `SOLANA_NETWORK` and `SOLANA_RPC_ENDPOINT` from env. :contentReference[oaicite:11]{index=11}  
- Ensure:

  ```ts
  export const SOLANA_NETWORK =
    process.env.NEXT_PUBLIC_SOLANA_TESTNET === 'false'
      ? WalletAdapterNetwork.Mainnet
      : WalletAdapterNetwork.Devnet;

  export const SOLANA_RPC_ENDPOINT =
    process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(SOLANA_NETWORK);
Enforce that all other Solana Connection usages (client & server) import SOLANA_RPC_ENDPOINT instead of re-building their own URL.

MOB-03 – Externalize Candy Machine configuration

In app/api/mint/init/route.ts, Candy Machine IDs and collection mints are currently hard-coded devnet:
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const CANDY_MACHINE_ID = publicKey("8HTS...");
const CANDY_GUARD_ID = publicKey("6BBp...");
const COLLECTION_MINT = publicKey("9JCd...");
const COLLECTION_AUTHORITY = publicKey("FFTL...");
const PAYMENT_DESTINATION = publicKey("5zHB...");
``` :contentReference[oaicite:12]{index=12}  

Replace them with env-driven constants:
const RPC_ENDPOINT = SOLANA_RPC_ENDPOINT;

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
Document these env vars in NFT_SYSTEM.md / env-config.md.

MOB-04 – Configure WalletConnect

In constants/solana.ts, WALLETCONNECT_PROJECT_ID currently falls back to a hard-coded string: 
GitHub

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  'cf0f4c50b8001a0045e9b9f3971dbdc0';


Replace with:

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn('[WalletConnect] Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID – mobile may fail.');
}

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';


Ensure a valid project ID is configured in Vercel for all environments.

3.2 Wallet Context & Connect Button

MOB-10 – Harden WalletContextProvider for mobile

File: components/WalletContextProvider.tsx. 
GitHub

Tasks:

Confirm structure:

<ConnectionProvider endpoint={endpoint}>
  <WalletProvider wallets={wallets} autoConnect={!userIsMobile}>
    <WalletModalProvider>{children}</WalletModalProvider>
  </WalletProvider>
</ConnectionProvider>


autoConnect disabled for mobile, allowed for desktop only.

Ensure wallets array:

On mobile: only SolanaMobileWalletAdapter + WalletConnectWalletAdapter.

On desktop: at least WalletConnectWalletAdapter; injected wallets (Phantom, Solflare) will hook via wallet-standard.

Use SOLANA_NETWORK and SOLANA_RPC_ENDPOINT from constants/solana.ts.

MOB-11 – Standardize WalletConnect UI

File: components/WalletConnect.tsx. 
GitHub

Tasks:

Keep WalletMultiButton as the primary entry point.

Keep deep-link helpers (getPhantomDeeplink, getSolflareDeeplink, etc.) as secondary fallback:

Add a small link “Having issues? Try opening directly in Phantom / Solflare / Trust” visible only on mobile if:

wallet is null and

connected === false after X seconds or after an error.

Ensure the component:

Returns null or skeleton while mounted === false.

Is fully responsive across breakpoints.

3.3 Authentication & Session

MOB-20 – Stabilize Auth Cookies

Files:

app/api/auth/nonce/route.ts 
GitHub

app/api/auth/verify/route.ts 
GitHub

lib/server/auth.ts 
GitHub

Tasks:

Confirm JWT_SECRET is required in production:

If missing and NODE_ENV === 'production', log a warning and potentially throw at startup in a future hardening iteration.

Keep cookies:

oink_auth_nonce – signed, HTTP-only, 5 min lifetime.

oink_auth_session – signed, HTTP-only, 24h lifetime.

Ensure sameSite: 'lax' is preserved to keep the flow compatible with mobile in-app browsers that redirect back to the same origin.

MOB-21 – Enforce login before tier / mint

File: components/VerifyMint.tsx. 
GitHub

Tasks:

Guarantee that:

handleVerify is the only way to set tierInfo.

handleMint always checks that tierInfo exists and that tierInfo.verified === true (if you decide to add a verified flag to the payload).

Add a defensive check in /api/mint/init to ensure the session wallet exists (already done) and optionally cross-check tier:

const tierInfo = await verifyWalletTier(userWalletStr);
if (tierInfo.tier === 'Oinkless') {
  return NextResponse.json({ error: 'Tier Oinkless cannot mint.' }, { status: 403 });
}


(Already present; keep it as source of truth.) 
GitHub

3.4 Tier Calculation & Oink Logic

MOB-30 – Centralize Tier Logic

File: lib/utils.ts (getWalletBalance, getTokenBalanceUSD, getWalletTier, verifyWalletTier). 
GitHub
+1

Tasks:

Ensure verifyWalletTier(walletAddress):

Gets SOL balance via getWalletBalance,

Gets token USD value via getTokenBalanceUSD,

Gets SOL price via fetchSOLPriceUSD,

Computes balanceUSD_total = balanceSOL * solPrice + tokenUSD,

Maps into a WalletTierInfo according to TIER_THRESHOLDS.

Keep TIER_THRESHOLDS aligned with the current Oink lore:

export const TIER_THRESHOLDS = {
  Oinkless: { min: 0, max: 10, nftRange: null },
  Oinklings: { min: 10, max: 1_000, nftRange: [1, 100] },
  Midings:  { min: 1_000, max: 10_000, nftRange: [100, 200] },
  Oinklords:{ min: 10_000, max: null, nftRange: [200, 300] },
} as const;


(Optional future ticket) Extend getTokenPriceUSD mapping to more SPL tokens (Jupiter / Helius integration) for richer Oink logic.

3.5 Mint Flow (Server & Client)

MOB-40 – Finalize Umi-based mint init

File: app/api/mint/init/route.ts. 
GitHub

Tasks:

Ensure RPC_ENDPOINT uses SOLANA_RPC_ENDPOINT (see MOB-02).

Keep the model:

backendSigner as dummy identity for Umi.

nftMint generated server-side (generateSigner(umi)).

minterSigner = createNoopSigner(user) to represent the end-user.

Transaction building:

const computeLimit = setComputeUnitLimit(umi, { units: 400_000 });
const computePrice = setComputeUnitPrice(umi, { microLamports: 0 });

const mintIx = mintV2(umi, {
  candyMachine: CANDY_MACHINE_ID,
  candyGuard: CANDY_GUARD_ID,
  nftMint,
  collectionMint: COLLECTION_MINT,
  collectionUpdateAuthority: COLLECTION_AUTHORITY,
  minter: minterSigner,
  mintArgs: { solPayment: some({ destination: PAYMENT_DESTINATION }) },
});

let builder = transactionBuilder()
  .add(computeLimit)
  .add(computePrice)
  .add(mintIx)
  .setFeePayer(minterSigner);


Partial signing:

const tx = await builder.build(umi);
const nftSigner = createSignerFromKeypair(umi, nftMint);
const partiallySignedTx = await nftSigner.signTransaction(tx);
const serializedTx = umi.transactions.serialize(partiallySignedTx);
const [base64Tx] = base64.deserialize(serializedTx);

return NextResponse.json({
  success: true,
  transaction: base64Tx,
  mint: nftMint.publicKey.toString(),
  message: 'Transaction initialized. Please sign in wallet.',
});


MOB-41 – Client-side mint completion

File: components/VerifyMint.tsx, handleMint. 
GitHub

Tasks:

Normalize the initRes JSON:

const { transaction: base64Tx } = await initRes.json();


Deserialize and sign:

const { VersionedTransaction, Connection } = await import('@solana/web3.js');

const txBuffer = Buffer.from(base64Tx, 'base64');
const transaction = VersionedTransaction.deserialize(txBuffer);

const adapter = wallet.adapter as any;
if (!adapter.signTransaction) throw new Error('Wallet does not support transaction signing');

const signedTx = await adapter.signTransaction(transaction);

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com');
const sig = await connection.sendRawTransaction(signedTx.serialize());
await connection.confirmTransaction(sig, 'confirmed');


Future improvement (optional ticket):

Replace the local new Connection(...) with a shared helper using SOLANA_RPC_ENDPOINT for full consistency.

3.6 UI Integration

MOB-50 – Clean up dual scan flows

File: app/page.tsx. 
GitHub

Tasks:

Decide on a single canonical UX:

Option A (recommended): Use VerifyMint page / component as the main entry for verification + mint, and deprecate the legacy handleScan + /api/verify-tier flow.

Option B: Keep handleScan only as a “quick preview”, but force VerifyMint for any mint.

Ensure the main CTA text is coherent:

Before login: “Connect wallet”

After connection: “Verify my Oinks”

After verification (eligible tiers): “Mint NFT”

Keep or remove the “debug console” block depending on whether you want it visible in production (currently present at bottom of page). 
GitHub

4. Testing
4.1 Manual QA Scenarios

Devnet – Phantom Mobile (iOS / Android)

Open https://<dev-deployment>.vercel.app inside mobile browser (Safari / Chrome).

Tap Connect:

OS sheet appears, Phantom is proposed.

Select Phantom → Phantom opens, shows “Connect to Oinkonomics”.

Approve connection.

Back in dApp, tap “Vérifier mes Oinks / Verify my Oinks”:

Phantom shows “Sign message” prompt with nonce.

Accept → dApp shows tier, USD value, and NFT #.

Tap Mint NFT:

Phantom shows “Approve transaction” with 0.01 SOL payment.

After confirmation, dApp shows success, logs signature.

Devnet – Trust Wallet via WalletConnect

Open dApp in Chrome Android.

Tap Connect:

WalletConnect sheet appears, pick Trust Wallet.

If WalletConnect project ID is correct, Trust Wallet opens a connection approval screen.

Proceed as above (verify, mint).

Oinkless scenario

Use a devnet wallet with < $10 equivalent.

Verify:

Tier must be Oinkless.

Mint button is disabled, with a clear error “NO MINT FOR YOU! Get $10 first!”.

Desktop – Brave with Phantom extension

Confirm that:

Brave’s built-in wallet does not hijack window.solana (thanks to using MWA + WalletConnect pattern).

Phantom extension can still connect via WalletMultiButton.

4.2 Regression Tests

Verify that:

/api/auth/nonce and /api/auth/verify set and read cookies correctly.

/api/tiers/current returns 401 when session is missing / expired.

/api/mint/init returns 403 for Oinkless wallets.

Rate limiting in /api/verify-tier and /api/tiers/current still works.

5. Deliverables

Updated code in:

constants/solana.ts

components/WalletContextProvider.tsx

components/WalletConnect.tsx

components/VerifyMint.tsx

app/api/auth/*

app/api/tiers/current/route.ts

app/api/mint/init/route.ts

lib/utils.ts (tier logic)

lib/server/auth.ts

app/page.tsx (UX integration)

New / updated docs:

docs/mobile-wallet-spec.md (this file)

docs/env-config.md

Updated NFT_SYSTEM.md with network + Candy Machine notes.

.env.example for devnet profile.