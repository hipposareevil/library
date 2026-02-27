import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import { useAuth } from "../context/AuthContext";
import { fetchSystemStatus, exportData, importData, backupToB2, listBackups, restoreFromBackup, deleteBackup, fixPublishDates, type BackupEntry, type FixDatesResult } from "../api/manage";

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

  // Backup state
  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<BackupEntry | null>(null);
  const [backupError, setBackupError] = useState("");
  const { data: backups, refetch: refetchBackups } = useQuery({
    queryKey: ["backups"],
    queryFn: listBackups,
  });

  // Restore state
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState("");
  const [restoreError, setRestoreError] = useState("");

  // Delete backup state
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  // Fix publish dates state
  const [fixingDates, setFixingDates] = useState(false);
  const [fixDatesResult, setFixDatesResult] = useState<FixDatesResult | null>(null);
  const [fixDatesError, setFixDatesError] = useState("");

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [importError, setImportError] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBackupError("");
    setBackupResult(null);
    setBacking(true);
    try {
      const result = await backupToB2();
      setBackupResult(result);
      refetchBackups();
    } catch {
      setBackupError("Backup failed. Check B2 credentials and try again.");
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async (entry: BackupEntry) => {
    if (!window.confirm(
      `Restore from "${entry.filename}"?\n\nThis will overwrite ALL current data (${entry.book_count} books) with the backup. This cannot be undone.`
    )) return;
    setRestoreError("");
    setRestoreResult("");
    setRestoringKey(entry.b2_key);
    try {
      await restoreFromBackup(entry.b2_key);
      setRestoreResult(`Restored from ${entry.filename}.`);
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    } catch {
      setRestoreError("Restore failed. Check backend logs.");
    } finally {
      setRestoringKey(null);
    }
  };

  const handleDeleteBackup = async (entry: BackupEntry) => {
    if (!window.confirm(
      `Delete backup "${entry.filename}"?\n\nThis cannot be undone.`
    )) return;
    setDeleteError("");
    setDeletingKey(entry.b2_key);
    try {
      await deleteBackup(entry.b2_key);
      refetchBackups();
    } catch {
      setDeleteError("Delete failed. Check backend logs.");
    } finally {
      setDeletingKey(null);
    }
  };

  const handleFixDates = async () => {
    setFixDatesError("");
    setFixDatesResult(null);
    setFixingDates(true);
    try {
      const result = await fixPublishDates();
      setFixDatesResult(result);
    } catch {
      setFixDatesError("Fix failed. Check backend logs.");
    } finally {
      setFixingDates(false);
    }
  };

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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
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

        {/* Database Backup */}
        <div className="manage-section">
          <h2>Database Backup</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 1rem" }}>
            Dump the full database (including cover art) and upload as a compressed SQL file to B2.
            EPUB files are already stored in B2 and are not included.
          </p>
          {backupError && <div className="form-error" style={{ marginBottom: "0.75rem" }}>{backupError}</div>}
          {backupResult && (
            <div className="form-success" style={{ marginBottom: "0.75rem" }}>
              Backup complete: <strong>{backupResult.filename}</strong> — {backupResult.book_count} books, {formatBytes(backupResult.size_bytes)}
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={handleBackup}
            disabled={backing}
          >
            {backing ? "Backing up…" : "Backup to B2"}
          </button>

          {restoreResult && <div className="form-success" style={{ marginTop: "0.75rem" }}>{restoreResult}</div>}
          {restoreError && <div className="form-error" style={{ marginTop: "0.75rem" }}>{restoreError}</div>}
          {deleteError && <div className="form-error" style={{ marginTop: "0.75rem" }}>{deleteError}</div>}

          {backups && backups.length > 0 && (
            <div style={{ marginTop: "1.25rem" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                Recent Backups
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "0.4rem 0.75rem 0.4rem 0", color: "var(--text-muted)", fontWeight: 500 }}>File</th>
                    <th style={{ padding: "0.4rem 0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Books</th>
                    <th style={{ padding: "0.4rem 0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Size</th>
                    <th style={{ padding: "0.4rem 0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Date</th>
                    <th style={{ padding: "0.4rem 0", color: "var(--text-muted)", fontWeight: 500 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b: BackupEntry) => (
                    <tr key={b.b2_key} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.4rem 0.75rem 0.4rem 0", fontFamily: "monospace", fontSize: "0.8rem" }}>{b.filename}</td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "var(--text-secondary)" }}>{b.book_count || "—"}</td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "var(--text-secondary)" }}>{formatBytes(b.size_bytes)}</td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "var(--text-secondary)" }}>{formatDate(b.uploaded_at)}</td>
                      <td style={{ padding: "0.4rem 0", display: "flex", gap: "0.4rem" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRestore(b)}
                          disabled={restoringKey !== null || deletingKey !== null}
                        >
                          {restoringKey === b.b2_key ? "Restoring…" : "Restore"}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteBackup(b)}
                          disabled={restoringKey !== null || deletingKey !== null}
                        >
                          {deletingKey === b.b2_key ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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


            <div className="data-card">
              <h3>Fix Publication Dates</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 1rem" }}>
                Find books with missing or invalid publication dates and update them from OpenLibrary.
              </p>
              {fixDatesError && <div className="form-error" style={{ marginBottom: "0.75rem" }}>{fixDatesError}</div>}
              {fixDatesResult && (
                <div className="form-success" style={{ marginBottom: "0.75rem" }}>
                  Checked {fixDatesResult.checked} books — updated {fixDatesResult.updated}, skipped {fixDatesResult.skipped}
                  {fixDatesResult.errors > 0 && `, ${fixDatesResult.errors} errors`}.
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={handleFixDates}
                disabled={fixingDates}
              >
                {fixingDates ? "Fixing…" : "Fix Dates"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
