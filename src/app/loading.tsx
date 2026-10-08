export default function Loading() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="skeleton-box" style={{ width: 220, height: 26, marginBottom: 8 }} />
          <div className="skeleton-box" style={{ width: 340, height: 14 }} />
        </div>
      </div>

      <div className="page-body">
        {/* 4 Stat Cards Skeleton */}
        <div className="stat-grid mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <div>
                <div className="skeleton-box" style={{ width: 110, height: 12, marginBottom: 8 }} />
                <div className="skeleton-box" style={{ width: 160, height: 24, marginBottom: 8 }} />
              </div>
              <div className="skeleton-box" style={{ width: 130, height: 10 }} />
            </div>
          ))}
        </div>

        {/* Data Card / Table Skeleton */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div className="skeleton-box" style={{ width: 180, height: 18 }} />
            <div className="skeleton-box" style={{ width: 90, height: 14 }} />
          </div>
          <div className="card-body-flush" style={{ padding: "16px 20px" }}>
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="flex justify-between items-center" style={{ padding: "8px 0" }}>
                  <div className="skeleton-box" style={{ width: "30%", height: 14 }} />
                  <div className="skeleton-box" style={{ width: "20%", height: 14 }} />
                  <div className="skeleton-box" style={{ width: "20%", height: 14 }} />
                  <div className="skeleton-box" style={{ width: "15%", height: 14 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

