import { getOutstandingAccItems, getCashBalances } from "../../actions/disbursement.actions";
import { getMasterCashAccounts } from "../../actions/acc.actions";
import DisbursementNewForm from "./DisbursementNewForm";

export default async function DisbursementNewPage() {
  const [outstandingItems, accounts, balances] = await Promise.all([
    getOutstandingAccItems(),
    getMasterCashAccounts(),
    getCashBalances(),
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
          <h1>Pencairan Baru</h1>
          <div className="page-header-subtitle">
            Pilih item ACC yang akan dicairkan
          </div>
        </div>
      </div>

      <div className="page-body">
        <DisbursementNewForm
          outstandingItems={itemsWithOutstanding}
          accounts={JSON.parse(JSON.stringify(accounts))}
          balances={JSON.parse(JSON.stringify(balances))}
        />
      </div>
    </>
  );
}
