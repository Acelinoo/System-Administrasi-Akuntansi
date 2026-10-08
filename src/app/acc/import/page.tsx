import React from "react";
import ImportWizard from "./ImportWizard";

export const metadata = {
  title: "Impor Data Excel — ProTrack",
  description: "Impor data ACC proyek dari file spreadsheet Excel terkontrol.",
};

export default function AccImportPage() {
  return (
    <div className="page-body" style={{ maxWidth: "1280px", margin: "0 auto", paddingTop: "var(--space-6)" }}>
      <ImportWizard />
    </div>
  );
}
