'use client';

/**
 * DocumentsPanel — drop-in case-documents UI.
 *
 * The two-step upload (browser → presigned PUT → S3) keeps PHI off our
 * api server entirely. Direct S3 PUT is what the bucket CORS allows
 * (see DataStack), and the api never touches the bytes.
 */
import { useEffect, useRef, useState } from 'react';

export type DocumentKind =
  | 'consent' | 'lab' | 'imaging' | 'history' | 'discharge' | 'education' | 'other';

export interface DocumentRow {
  id: string;
  caseId: string;
  name: string;
  contentType: string;
  sizeBytes: number | null;
  kind: DocumentKind;
  patientVisible: boolean;
  uploadedByUserId: string;
  createdAt: string;
}

const KINDS: DocumentKind[] = [
  'consent', 'lab', 'imaging', 'history', 'discharge', 'education', 'other',
];

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

function fmtSize(b: number | null): string {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  caseId: string;
  /** Hide the upload form (e.g. patient view in M9 polish). */
  readOnly?: boolean;
}

export function DocumentsPanel({ caseId, readOnly }: Props) {
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Upload-form state
  const [kind, setKind] = useState<DocumentKind>('other');
  const [pv, setPv] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setError(null);
    try {
      const r = await jsonOrThrow<{ items: DocumentRow[] }>(
        await fetch(`/api/documents?caseId=${caseId}&limit=200`),
      );
      setDocs(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [caseId]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setUploading(true);
    setError(null);
    try {
      const meta = await jsonOrThrow<{
        document: DocumentRow;
        uploadUrl: string;
      }>(
        await fetch('/api/documents/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId,
            name: f.name,
            contentType: f.type || 'application/octet-stream',
            sizeBytes: f.size,
            kind,
            patientVisible: pv,
          }),
        }),
      );
      const put = await fetch(meta.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': f.type || 'application/octet-stream' },
        body: f,
      });
      if (!put.ok) {
        throw new Error(`S3 PUT failed: ${put.status} ${put.statusText}`);
      }
      if (fileRef.current) fileRef.current.value = '';
      setKind('other');
      setPv(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function downloadDoc(d: DocumentRow) {
    setBusyId(d.id);
    try {
      const r = await jsonOrThrow<{ url: string }>(
        await fetch(`/api/documents/${d.id}/download-url`),
      );
      // Trigger the download in a new tab.
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>Documents</h3>
        {docs && <span className="status-pill neutral">{docs.length}</span>}
      </div>

      {error && <div style={{ color: 'var(--danger, #c0392b)', marginBottom: 12 }}>{error}</div>}

      {!docs ? (
        <div className="muted">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="muted" style={{ marginBottom: 12 }}>No documents on this case yet.</div>
      ) : (
        <table className="data-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Size</th>
              <th>Visibility</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="cell-primary">{d.name}</div>
                  <div className="cell-sub">{d.contentType}</div>
                </td>
                <td><span className={`status-pill ${d.kind}`}>{d.kind}</span></td>
                <td className="muted">{fmtSize(d.sizeBytes)}</td>
                <td>
                  {d.patientVisible ? (
                    <span className="status-pill neutral" style={{ fontSize: 11 }}>visible to patient</span>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>care team only</span>
                  )}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {new Date(d.createdAt).toLocaleString()}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline-dark"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => void downloadDoc(d)}
                    disabled={busyId === d.id}
                  >
                    {busyId === d.id ? '…' : 'Download'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readOnly && (
        <form onSubmit={upload} style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto auto', gap: 8, alignItems: 'center' }}>
          <input ref={fileRef} type="file" required style={{ fontSize: 13 }} />
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-700, #555)' }}>
            <input type="checkbox" checked={pv} onChange={(e) => setPv(e.target.checked)} />
            Patient
          </label>
          <button className="btn btn-primary" type="submit" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}
    </div>
  );
}
