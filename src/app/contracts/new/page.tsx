import { redirect } from "next/navigation";

import { NewContractForm } from "@/components/new-contract-form";
import { WalletProvider } from "@/components/wallet";
import { getCurrentUser } from "@/lib/auth";
import { networkConfig } from "@/lib/stellar/network";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? sp[k] : "");

  return (
    <WalletProvider networkPassphrase={networkConfig().networkPassphrase}>
      <NewContractForm
        defaultWallet={user.stellarAddress ?? ""}
        prefill={{
          landlordAlias: pick("landlord"),
          guaranteeAmount: pick("amount"),
          rentAmount: pick("rent"),
          propertyLabel: pick("property"),
          propertyAddress: pick("address"),
        }}
      />
    </WalletProvider>
  );
}
