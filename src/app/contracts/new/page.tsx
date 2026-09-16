import { redirect } from "next/navigation";

import { NewContractForm } from "@/components/new-contract-form";
import { WalletProvider } from "@/components/wallet";
import { getCurrentUser } from "@/lib/auth";
import { networkConfig } from "@/lib/stellar/network";

export default async function NewContractPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <WalletProvider networkPassphrase={networkConfig().networkPassphrase}>
      <NewContractForm defaultWallet={user.stellarAddress ?? ""} />
    </WalletProvider>
  );
}
