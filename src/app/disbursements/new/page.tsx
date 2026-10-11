import { getOutstandingAccItems, getCashBalances } from "../../actions/disbursement.actions";
import { getMasterCashAccounts } from "../../actions/acc.actions";
import DisbursementNewForm from "./DisbursementNewForm";
import { DataScope } from "@prisma/client";

export default async function DisbursementNewPage({
  searchParams,
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const params = await searchParams;
  const isTest = params?.scope === "TEST";
  const scope = isTest ? DataScope.TEST : DataScope.REAL;

  const [outstandingItems, accounts, balances] = await Promise.all([
    getOutstandingAccItems(scope),
    getMasterCashAccounts(),
    getCashBalances(scope),
  ]);

  // Compute remaining outstanding for each item
  const itemsWithOutstanding = outstandingItems.map((item) => {
    const realized = item.disbursementItems.reduce(
      (s, d) => s + Number(d.realizedAmount),
      0
    );
    const approved = Number(item.approvedAmount);
    return {
      id: item.id,
      noKas: item.noKas,
      description: item.description,
      projectCode: item.project.code,
      projectName: item.project.name,
      picName: item.pic.name,
      categoryName: item.category.name,
      approvedAmount: approved,
      realizedAmount: realized,
      outstanding: Math.max(0, approved - realized),
      status: item.status,
    };
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1>Pencairan Baru</h1>
            {isTest && (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "4px",
                  border: "1px solid #fcd34d",
                  letterSpacing: "0.5px",
                }}
              >
                MODE UJI COBA (dataScope: TEST)
              </span>
            )}
          </div>
          <div className="page-header-subtitle">
            {isTest
              ? "Lingkungan Terisolasi — Hanya menampilkan item ACC TEST dan akun kas pembayar TEST. Data REAL aman."
              : "Pilih item ACC yang akan dicairkan"}
          </div>
        </div>
      </div>

      <div className="page-body">
        <DisbursementNewForm
          outstandingItems={itemsWithOutstanding}
          accounts={JSON.parse(JSON.stringify(accounts))}
          balances={JSON.parse(JSON.stringify(balances))}
          scope={isTest ? "TEST" : "REAL"}
        />
      </div>
    </>
  );
}
