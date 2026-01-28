//Σελίδα για analytics
import { useEffect, useMemo, useState } from "react";
import { fetchCourseStats } from "../api/courses";

function ListSection({
  title,
  rows,
  defaultLimit = 15,
  showToggle = true,
  emptyText = "No data",
}) {
  const [showAll, setShowAll] = useState(false);

  const limitedRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    return showAll ? rows : rows.slice(0, defaultLimit);
  }, [rows, showAll, defaultLimit]);

  const canToggle = showToggle && Array.isArray(rows) && rows.length > defaultLimit;

  return (
    <section style={{ marginTop: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <h3 style={{ marginBottom: "0.5rem" }}>{title}</h3>

        {canToggle && (
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            style={{
              padding: "0.35rem 0.6rem",
              cursor: "pointer",
            }}
          >
            {showAll ? "Hide" : "Show all"}
          </button>
        )}
      </div>

      {!rows || rows.length === 0 ? (
        <div style={{ opacity: 0.7 }}>{emptyText}</div>
      ) : (
        <>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {limitedRows.map((r) => (
              <li key={String(r._id)}>
                <strong>{r._id || "unknown"}</strong>: {r.count}
              </li>
            ))}
          </ul>

          {!showAll && canToggle && (
            <div style={{ marginTop: "0.5rem", opacity: 0.7 }}>
              Showing top {defaultLimit} of {rows.length}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // φιλτράρουμε "unknown" μόνο για level στο UI gia να μην φαίνεται άδειο
  const filteredLevel = useMemo(() => {
    if (!data?.byLevel) return [];
    return data.byLevel.filter(
      (x) => x?._id && !["unknown", "Unknown", ""].includes(String(x._id))
    );
  }, [data]);

  useEffect(() => {
    (async () => {
      try {
        setError("");
        const stats = await fetchCourseStats();
        setData(stats);
      } catch (e) {
        console.error(e);
        setError("Failed to load analytics.");
      }
    })();
  }, []);

  if (error) return <div style={{ padding: "1rem" }}>{error}</div>;
  if (!data) return <div style={{ padding: "1rem" }}>Loading…</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Analytics</h2>

      <p style={{ marginTop: "0.5rem" }}>
        <strong>Total courses:</strong> {data.total}
      </p>

      {/* Source counts: λίγα*/}
      <ListSection
        title="Courses by source"
        rows={data.bySource}
        defaultLimit={10}
        showToggle={false}
      />

      {/* Languages: έχει πολλά για αυτό toggle */}
      <ListSection
        title="Courses by language"
        rows={data.byLanguage}
        defaultLimit={15}
        showToggle={true}
      />

      {/* Levels: το filter βγάζει unknown */}
      <ListSection
        title="Courses by level"
        rows={filteredLevel}
        defaultLimit={10}
        showToggle={false}
        emptyText="No level info available in the dataset."
      />

      {/* Keywords: έχει αρκετά ενεργό toggle*/}
      <ListSection
        title="Top keywords (categories)"
        rows={data.topKeywords}
        defaultLimit={20}
        showToggle={true}
      />
    </div>
  );
}
