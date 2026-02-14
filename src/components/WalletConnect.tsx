"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, LogOut } from "lucide-react";
import { formatAddress } from "@/lib/web3Client";
import { getNetworkConfig } from "@/config/chains";
import { NetworkType } from "@/types";

interface WalletConnectProps {
  network?: NetworkType;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export default function WalletConnect({ network = "bsc-mainnet" }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);

  const targetChainId = getNetworkConfig(network).chainId;
  const isCorrectChain = chainId === targetChainId;

  useEffect(() => {
    checkConnection();

    if (window.ethereum) {
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
    }
  }, []);

  const checkConnection = async () => {
    if (!window.ethereum) return;
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
  };

  const connect = async () => {
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

  const switchNetwork = async () => {
    if (!window.ethereum) return;

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

  if (address) {
    return (
      <div className="flex items-center gap-2">
        {!isCorrectChain && (
          <Button variant="destructive" size="sm" onClick={switchNetwork}>
            Switch to BSC
          </Button>
        )}
        <Badge variant="outline" className="py-1.5 px-3">
          <Wallet className="h-3 w-3 mr-1.5" />
          {formatAddress(address)}
        </Badge>
        <Button variant="ghost" size="icon" onClick={disconnect} className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={connect} disabled={connecting} variant="outline" size="sm">
      <Wallet className="h-4 w-4 mr-2" />
      {connecting ? "Connecting..." : !window.ethereum ? "Install MetaMask" : "Connect Wallet"}
    </Button>
  );
}
