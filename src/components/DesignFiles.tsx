"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise, File, FileCode, FileImage, FileText, FloppyDisk, UploadSimple, X } from "@phosphor-icons/react";
import type { ProjectFileRecord } from "@/lib/types";

function apiPath(projectId: string, filePath: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/files/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}
function sizeLabel(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function KindIcon({ kind }: { kind: ProjectFileRecord["kind"] }) {
  if (kind === "image") return <FileImage size={20} />;
  if (kind === "code") return <FileCode size={20} />;
  if (kind === "document" || kind === "data") return <FileText size={20} />;
  return <File size={20} />;
}

export default function DesignFiles({ projectId, title, onClose }: { projectId: string; title: string; onClose: () => void }) {
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = files.find((file) => file.path === selectedPath);
  async function refresh(preferred?: string) {
    setLoading(true);
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, { cache: "no-store" });
    const data = await response.json();
    const next = (data.files ?? []) as ProjectFileRecord[];
    setFiles(next);
    setSelectedPath((current) => preferred ?? (next.some((file) => file.path === current) ? current : next[0]?.path ?? ""));
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, [projectId]);
  useEffect(() => {
    if (!selected?.editable) { setContent(""); setSavedContent(""); return; }
    fetch(apiPath(projectId, selected.path), { cache: "no-store" }).then((response) => response.text()).then((text) => { setContent(text); setSavedContent(text); });
  }, [projectId, selected?.path, selected?.editable]);
  const groups = useMemo(() => [
    { key: "generated", label: "Generated", files: files.filter((file) => file.source === "generated") },
    { key: "uploaded", label: "Uploads", files: files.filter((file) => file.source === "uploaded") },
  ], [files]);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []); if (!picked.length) return;
    const form = new FormData(); picked.forEach((file) => form.append("files", file));
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) { window.alert(data.error ?? "Upload failed"); return; }
    const next = data.files as ProjectFileRecord[]; setFiles(next);
    setSelectedPath(next.find((file) => file.source === "uploaded")?.path ?? ""); event.target.value = "";
  }
  async function save() {
    if (!selected?.editable || content === savedContent) return; setSaving(true);
    const response = await fetch(apiPath(projectId, selected.path), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (response.ok) setSavedContent(content); setSaving(false);
  }
  return (
    <section className="design-files" aria-label="Design Files">
      <header className="design-files-head"><div><strong>Design Files</strong><span>{title}</span></div><div className="design-files-actions">
        <button onClick={() => void refresh()} title="Refresh files"><ArrowClockwise size={17} /></button>
        <button className="design-files-upload" onClick={() => inputRef.current?.click()}><UploadSimple size={17} /> Upload</button>
        <input ref={inputRef} type="file" multiple hidden onChange={upload} />
        <button onClick={onClose} title="Back to deck"><X size={18} /></button>
      </div></header>
      <div className="design-files-body"><aside className="design-files-list"><div className="design-files-root"><span>Project</span><small>{files.length} files</small></div>
        {loading ? <p className="design-files-empty">Loading files…</p> : groups.map((group) => group.files.length > 0 && <div className="design-files-group" key={group.key}><h3>{group.label}<span>{group.files.length}</span></h3>{group.files.map((file) => <button key={file.path} className={file.path === selectedPath ? "active" : ""} onClick={() => setSelectedPath(file.path)}><span className={`design-file-icon ${file.kind}`}><KindIcon kind={file.kind} /></span><span className="design-file-copy"><strong>{file.name}</strong><small>{file.path.split("/").slice(0, -1).join(" / ")} · {sizeLabel(file.size)}</small></span></button>)}</div>)}
        {!loading && files.length === 0 && <p className="design-files-empty">Files created during the deck workflow will appear here.</p>}
      </aside><main className="design-file-viewer">
        {!selected ? <div className="design-file-placeholder"><File size={40} /><strong>Select a file</strong><span>Preview and edit project artifacts here.</span></div> : <><div className="design-file-toolbar"><div><strong>{selected.name}</strong><span>{selected.path}</span></div>{selected.editable && <button disabled={saving || content === savedContent} onClick={save}><FloppyDisk size={16} />{saving ? "Saving…" : content !== savedContent ? "Save changes" : "Saved"}</button>}</div><div className="design-file-content">{selected.kind === "image" ? <img src={apiPath(projectId, selected.path)} alt={selected.name} /> : selected.editable ? <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} aria-label={`Edit ${selected.name}`} /> : <iframe src={apiPath(projectId, selected.path)} title={selected.name} />}</div></>}
      </main></div>
    </section>
  );
}
