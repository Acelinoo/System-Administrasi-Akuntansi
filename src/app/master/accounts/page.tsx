import { getMasterCashAccountsList } from "../../actions/master.actions";
import AccountsManager from "./AccountsManager";

export default async function MasterAccountsPage() {
  const accounts = await getMasterCashAccountsList();

  return <AccountsManager accounts={accounts as any} />;
}
