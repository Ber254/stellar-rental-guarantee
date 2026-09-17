"use client";

import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { useI18n } from "./i18n-provider";
import { Button } from "./ui";

const shorten = (address: string) =>
  `${address.slice(0, 4)}…${address.slice(-4)}`;

type WalletState = {
  address: string | null;
  available: boolean;
  connect: () => Promise<string | null>;
  sign: (xdr: string) => Promise<string>;
  error: string | null;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({
  networkPassphrase,
  children,
}: {
  networkPassphrase: string;
  children: ReactNode;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const connected = await isConnected();
      if (!active) return;
      setAvailable(Boolean(connected.isConnected));
      if (!connected.isConnected) return;
      const current = await getAddress();
      if (active && current.address) setAddress(current.address);
    })().catch(() => setAvailable(false));
    return () => {
      active = false;
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const access = await requestAccess();
    if (access.error) {
      setError(String(access.error));
      return null;
    }
    setAddress(access.address);
    return access.address;
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      const result = await signTransaction(xdr, {
        networkPassphrase,
        address: address ?? undefined,
      });
      if (result.error) throw new Error(String(result.error));
      return result.signedTxXdr;
    },
    [address, networkPassphrase],
  );

  return (
    <WalletContext.Provider value={{ address, available, connect, sign, error }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}

export function ConnectWalletButton() {
  const { address, available, connect, error } = useWallet();
  const { t } = useI18n();

  if (address) {
    return (
      <span className="rounded-card border border-line bg-ok-bg px-3 py-2 font-mono text-xs text-ok-fg">
        {shorten(address)}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" onClick={() => void connect()}>
        {t.wallet.connect}
      </Button>
      {!available && (
        <span className="text-xs text-muted">{t.wallet.notDetected}</span>
      )}
      {error && <span className="text-xs text-danger-fg">{error}</span>}
    </div>
  );
}
