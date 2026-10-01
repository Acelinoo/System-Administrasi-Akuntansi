import React from "react";
import ImportWizard from "./ImportWizard";

export const metadata = {
  title: "Impor Data Excel — ProTrack",
  description: "Impor data pengajuan ACC proyek dari file spreadsheet Excel terkontrol.",
};

export default function AccImportPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <ImportWizard />
    </div>
  );
}
