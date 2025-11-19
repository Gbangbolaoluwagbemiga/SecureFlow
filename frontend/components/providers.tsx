"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { Web3Provider } from "@/contexts/web3-context";
import { DelegationProvider } from "@/contexts/delegation-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { wagmiConfig } from "@/contexts/web3-context";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside client component to avoid serialization issues
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <Web3Provider>
          <DelegationProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </DelegationProvider>
        </Web3Provider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
