import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import { useAuth } from "../context/AuthContext";
import { fetchSystemStatus, exportData, importData } from "../api/manage";

export default function ManagePage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["system-status"],
    queryFn: fetchSystemStatus,
  });

  // Export state
  const [exportCovers, setExportCovers] = useState(false);
  const [exportEpubs, setExportEpubs] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [importError, setImportError] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExportError("");
    setExporting(true);
    try {
      await exportData(exportCovers, exportEpubs);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportError("");
    setImportResult("");
    setImporting(true);
    try {
      const result = await importData(importFile);
      setImportResult(`Imported ${result.imported} of ${result.total} books.`);
      setImportFile(null);
      if (importInputRef.current) importInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    } catch {
      setImportError("Import failed. Ensure the file is a valid export ZIP.");
    } finally {
      setImporting(false);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      <Header />
      <main className="container" style={{ padding: "2rem 1.5rem" }}>
        <h1 style={{ marginBottom: "1.5rem" }}>Databases</h1>

        {/* System Status */}
        <div className="manage-section">
          <h2>System Status</h2>
          {statusLoading ? (
            <div className="loading">Checking connections...</div>
          ) : (
            <div className="status-grid">
              <div className="status-card">
                <div className="status-card-header">
                  <svg
                    className={`status-icon ${status?.database?.connected ? "connected" : "disconnected"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 5v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5" />
                    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                  </svg>
                  Database
                </div>
                {status?.database?.connected ? (
                  <>
                    <div className="status-detail">
                      <span>Name:</span> {status.database.name}
                    </div>
                    <div className="status-detail">
                      <span>Books:</span> {status.database.book_count ?? 0}
                    </div>
                  </>
                ) : (
                  <div className="status-detail" style={{ color: "var(--danger)" }}>
                    {status?.database?.error || "Not connected"}
                  </div>
                )}
              </div>

              <div className="status-card">
                <div className="status-card-header">
                  <svg
                    className={`status-icon ${status?.b2?.connected ? "connected" : "disconnected"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                  </svg>
                  Backblaze B2 Storage
                </div>
                {status?.b2?.connected ? (
                  <>
                    <div className="status-detail">
                      <span>Bucket:</span> {status.b2.bucket_name}
                    </div>
                    <div className="status-detail">
                      <span>Endpoint:</span> {status.b2.endpoint}
                    </div>
                    <div className="status-detail">
                      <span>EPUBs:</span> {status.b2.epub_count ?? 0}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="status-detail" style={{ color: "var(--danger)" }}>
                      {status?.b2?.error || "Not connected"}
                    </div>
                    {status?.b2?.epub_count !== undefined && (
                      <div className="status-detail">
                        <span>EPUBs:</span> {status.b2.epub_count}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Data Management */}
        <div className="manage-section">
          <h2>Data Management</h2>
          <div className="data-mgmt-grid">
            <div className="data-card">
              <h3>Export</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 1rem" }}>
                Download all book metadata as a ZIP archive.
              </p>
              <div className="data-card-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={exportCovers}
                    onChange={(e) => setExportCovers(e.target.checked)}
                  />
                  Include cover images
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={exportEpubs}
                    onChange={(e) => setExportEpubs(e.target.checked)}
                  />
                  Include EPUB files
                </label>
              </div>
              {exportError && <div className="form-error">{exportError}</div>}
              <button
                className="btn btn-primary"
                onClick={handleExport}
                disabled={exporting}
                style={{ marginTop: "1rem" }}
              >
                {exporting ? "Exporting..." : "Export"}
              </button>
            </div>

            <div className="data-card">
              <h3>Import</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 1rem" }}>
                Restore books from a library export ZIP.
              </p>
              <div className="form-group">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".zip"
                  className="input"
                  style={{ cursor: "pointer" }}
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setImportResult("");
                    setImportError("");
                  }}
                />
              </div>
              {importError && <div className="form-error">{importError}</div>}
              {importResult && <div className="form-success">{importResult}</div>}
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || !importFile}
                style={{ marginTop: "0.5rem" }}
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
