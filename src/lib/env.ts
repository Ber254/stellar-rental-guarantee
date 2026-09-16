const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const serverEnv = {
  databaseUrl: () => required("DATABASE_URL"),
  authSecret: () => required("AUTH_SECRET"),
  stellarNetwork: () => process.env.STELLAR_NETWORK ?? "testnet",
  stellarRpcUrl: () =>
    process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
  stellarHorizonUrl: () =>
    process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  networkPassphrase: () =>
    process.env.STELLAR_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015",
  usdcIssuer: () => process.env.STELLAR_USDC_ISSUER ?? "",
  usdcCode: () => process.env.STELLAR_USDC_CODE ?? "USDC",
  usdcSacId: () => process.env.STELLAR_USDC_CONTRACT_ID ?? "",
  sorobanContractId: () => process.env.SOROBAN_CONTRACT_ID ?? "",
  platformSecretKey: () => process.env.PLATFORM_SECRET_KEY ?? "",
  demoMode: () => process.env.NEXT_PUBLIC_DEMO_MODE === "true",
};

export const isChainConfigured = () =>
  Boolean(
    process.env.SOROBAN_CONTRACT_ID &&
      process.env.STELLAR_USDC_CONTRACT_ID &&
      process.env.PLATFORM_SECRET_KEY,
  );
