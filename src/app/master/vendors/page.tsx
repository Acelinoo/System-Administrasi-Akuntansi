import { getMasterVendorsList } from "../../actions/master.actions";
import VendorsManager from "./VendorsManager";

export default async function MasterVendorsPage() {
  const vendors = await getMasterVendorsList();

  return <VendorsManager vendors={JSON.parse(JSON.stringify(vendors))} />;
}
