import { getMasterCategoriesList } from "../../actions/master.actions";
import CategoriesManager from "./CategoriesManager";

export default async function MasterCategoriesPage() {
  const categories = await getMasterCategoriesList();

  return <CategoriesManager categories={categories} />;
}
