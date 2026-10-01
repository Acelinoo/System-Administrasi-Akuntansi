import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main-wrapper">
        <TopHeader />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
