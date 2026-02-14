"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { formatAddress } from "@/lib/web3Client";
import {
  getNetworkByChainId,
  SUPPORTED_NETWORKS,
  getNetworkConfig,
} from "@/config/chains";
import { NetworkType } from "@/types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        callback: (...args: unknown[]) => void
      ) => void;
    };
  }
}

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  const currentNetwork = chainId ? getNetworkByChainId(chainId) : null;

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
    setMounted(true);
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
      window.ethereum?.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [checkConnection]);

  const connect = async () => {
    if (typeof window === "undefined") return;
    if (!window.ethereum) {
      window.open("https://metamask.io", "_blank");
      return;
    }

    setConnecting(true);
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
    } finally {
      setConnecting(false);
    }
  };

  const switchToNetwork = async (network: NetworkType) => {
    if (typeof window === "undefined" || !window.ethereum) return;
    setShowNetworkMenu(false);

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
  };

  const disconnect = () => {
    setAddress(null);
    setChainId(null);
  };

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Wallet className="h-4 w-4 mr-2" />
        Connect Wallet
      </Button>
    );
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        {/* Network selector dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowNetworkMenu(!showNetworkMenu)}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                currentNetwork ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {currentNetwork
              ? SUPPORTED_NETWORKS.find((n) => n.value === currentNetwork)
                  ?.label
              : "Wrong Network"}
            <ChevronDown className="h-3 w-3" />
          </Button>

          {showNetworkMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNetworkMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border bg-popover p-1 shadow-md">
                {SUPPORTED_NETWORKS.map((net) => (
                  <button
                    key={net.value}
                    onClick={() => switchToNetwork(net.value)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent transition-colors ${
                      currentNetwork === net.value
                        ? "text-primary font-medium"
                        : "text-foreground"
                    }`}
                  >
                    {net.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Address */}
        <Badge variant="outline" className="py-1.5 px-3">
          <Wallet className="h-3 w-3 mr-1.5" />
          {formatAddress(address)}
        </Badge>

        {/* Disconnect */}
        <Button
          variant="ghost"
          size="icon"
          onClick={disconnect}
          className="h-8 w-8"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={connect} disabled={connecting} variant="outline" size="sm">
      <Wallet className="h-4 w-4 mr-2" />
      {connecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}
