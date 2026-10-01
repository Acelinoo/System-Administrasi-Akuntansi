import { getMasterProjects, getMasterCategories, getMasterPics } from "../../actions/acc.actions";
import AccNewForm from "./AccNewForm";

export default async function AccNewPage() {
  const [projects, categories, pics] = await Promise.all([
    getMasterProjects(),
    getMasterCategories(),
    getMasterPics(),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Input Pengajuan ACC Baru</h1>
          <div className="page-header-subtitle">
            Masukkan data pengajuan yang sudah di-ACC oleh atasan
          </div>
        </div>
      </div>

      <div className="page-body">
        <AccNewForm
          projects={JSON.parse(JSON.stringify(projects))}
          categories={JSON.parse(JSON.stringify(categories))}
          pics={JSON.parse(JSON.stringify(pics))}
        />
      </div>
    </>
  );
}
