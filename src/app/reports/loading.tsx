export default function ReportsLoading() {
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="skeleton-box" style={{ width: 260, height: 20, marginBottom: 6 }} />
          <div className="skeleton-box" style={{ width: 380, height: 12 }} />
        </div>
        <div className="skeleton-box" style={{ width: 140, height: 32, borderRadius: 6 }} />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="card mb-6" style={{ padding: "12px 16px" }}>
        <div className="flex gap-4 items-center">
          <div className="skeleton-box" style={{ width: 140, height: 32 }} />
          <div className="skeleton-box" style={{ width: 140, height: 32 }} />
          <div className="skeleton-box" style={{ width: 200, height: 32 }} />
        </div>
      </div>

      {/* 4 Stat Cards Skeleton */}
      <div className="stat-grid mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card">
            <div>
              <div className="skeleton-box" style={{ width: 120, height: 12, marginBottom: 8 }} />
              <div className="skeleton-box" style={{ width: 150, height: 22, marginBottom: 8 }} />
            </div>
            <div className="skeleton-box" style={{ width: 100, height: 10 }} />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="card">
        <div className="card-body-flush" style={{ padding: "18px 20px" }}>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--color-border-subtle)" }}>
              <div className="skeleton-box" style={{ width: "35%", height: 14 }} />
              <div className="skeleton-box" style={{ width: "18%", height: 14 }} />
              <div className="skeleton-box" style={{ width: "18%", height: 14 }} />
              <div className="skeleton-box" style={{ width: "18%", height: 14 }} />
            </div>
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className="flex justify-between items-center" style={{ padding: "10px 0" }}>
                <div className="skeleton-box" style={{ width: "32%", height: 14 }} />
                <div className="skeleton-box" style={{ width: "16%", height: 14 }} />
                <div className="skeleton-box" style={{ width: "16%", height: 14 }} />
                <div className="skeleton-box" style={{ width: "16%", height: 14 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
