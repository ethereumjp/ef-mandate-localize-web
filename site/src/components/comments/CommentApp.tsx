import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "../../web3/config";

const queryClient = new QueryClient();

interface Props {
  lang: string;
}

export default function CommentApp({ lang }: Props) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div data-comment-app data-lang={lang} hidden />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
