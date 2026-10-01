import { getMasterProjectsList } from "../../actions/master.actions";
import ProjectsManager from "./ProjectsManager";

export default async function MasterProjectsPage() {
  const projects = await getMasterProjectsList();

  return <ProjectsManager projects={projects} />;
}
