import { getMasterCoaList } from "../../actions/master.actions";
import CoaManager from "./CoaManager";

export default async function MasterCoaPage() {
  const coaList = await getMasterCoaList();

  return <CoaManager coaList={coaList} />;
}
