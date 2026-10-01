import { getMasterPicsList } from "../../actions/master.actions";
import PicManager from "./PicManager";

export default async function MasterPicPage() {
  const pics = await getMasterPicsList();

  return <PicManager pics={pics} />;
}
