"use client";

import { useState, useEffect, useCallback } from "react";
import { getNetworkConfig } from "@/config/chains";
import { NetworkType } from "@/types";
import { WalletState } from "./types";

/**
 * Hook that reads wallet state directly from window.ethereum.
 * Mirrors the pattern used in WalletConnect.tsx.
 */
export function useWalletState(network: NetworkType): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const targetChainId = getNetworkConfig(network).chainId;

  const checkConnection = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as string[];
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        const chain = (await window.ethereum.request({
          method: "eth_chainId",
        })) as string;
        setChainId(parseInt(chain, 16));
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    checkConnection();

    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts[0] || null);
    };
    const handleChainChanged = (...args: unknown[]) => {
      setChainId(parseInt(args[0] as string, 16));
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [checkConnection]);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      window.open("https://metamask.io", "_blank");
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      setAddress(accounts[0]);
      const chain = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      setChainId(parseInt(chain, 16));
    } catch {
      // User rejected
    }
  }, []);

  const switchToNetwork = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const config = getNetworkConfig(network);
    const chainIdHex = `0x${config.chainId.toString(16)}`;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (error: unknown) {
      if ((error as { code: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: config.name,
              rpcUrls: [config.rpcUrl],
              nativeCurrency: config.nativeCurrency,
              blockExplorerUrls: [config.explorerUrl],
            },
          ],
        });
      }
    }
  }, [network]);

  return {
    connected: !!address,
    address,
    chainId,
    isCorrectNetwork: chainId === targetChainId,
    connect,
    switchNetwork: switchToNetwork,
  };
}
