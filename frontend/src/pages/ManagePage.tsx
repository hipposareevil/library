import { useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import { useAuth } from "../context/AuthContext";
import {
  fetchSystemStatus,
  fetchUsers,
  createUser,
  changePassword,
  deleteUser,
  exportData,
  importData,
} from "../api/manage";
import type { User } from "../types/user";

export default function ManagePage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["system-status"],
    queryFn: fetchSystemStatus,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  // Add user state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Change password state
  const [changingUser, setChangingUser] = useState<User | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await createUser(newUsername, newPassword);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowAddUser(false);
      setNewUsername("");
      setNewPassword("");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response: { data: { detail: string } } }).response?.data
              ?.detail ?? "Failed to create user")
          : "Failed to create user";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!changingUser) return;
    setError("");
    setSaving(true);
    try {
      await changePassword(changingUser.id, newPwd);
      setChangingUser(null);
      setNewPwd("");
    } catch {
      setError("Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    try {
      await deleteUser(user.id);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response: { data: { detail: string } } }).response?.data
              ?.detail ?? "Failed to delete user")
          : "Failed to delete user";
      alert(msg);
    }
  };

  return (
    <>
      <Header />
      <main className="container" style={{ padding: "2rem 1.5rem" }}>
        <h1 style={{ marginBottom: "1.5rem" }}>System Management</h1>

        {/* System Status Section */}
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

        {/* Data Management Section */}
        <div className="manage-section">
          <h2>Data Management</h2>
          <div className="data-mgmt-grid">
            {/* Export */}
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

            {/* Import */}
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
              {importResult && (
                <div className="form-success">{importResult}</div>
              )}
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

        {/* User Management Section */}
        <div className="manage-section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <h2 style={{ border: "none", padding: 0, margin: 0 }}>Users</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowAddUser(true);
                setError("");
              }}
            >
              + Add User
            </button>
          </div>

          {usersLoading ? (
            <div className="loading">Loading users...</div>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Created</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : ""}
                    </td>
                    <td>
                      <div className="user-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setChangingUser(user);
                            setNewPwd("");
                            setError("");
                          }}
                        >
                          Password
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(user)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add User Modal */}
        {showAddUser && (
          <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Add User</h2>
              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    className="input"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <div className="form-error">{error}</div>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddUser(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {changingUser && (
          <div
            className="modal-overlay"
            onClick={() => setChangingUser(null)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Change Password for {changingUser.username}</h2>
              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    className="input"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                {error && <div className="form-error">{error}</div>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setChangingUser(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Change Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
