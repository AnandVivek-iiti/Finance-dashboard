import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

const ACCEPTED = [".xls", ".xlsx", ".pdf"];

export default function FileDropzone({ onFileSelected, disabled }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      alert(`Unsupported file type "${ext}". Please upload a .xls, .xlsx, or .pdf bank statement.`);
      return;
    }
    onFileSelected(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-colors ${
        dragActive ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/50"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <UploadCloud size={26} />
      </div>
      <div>
        <p className="font-display text-lg font-semibold text-ink">
          Drop your statement here, or click to browse
        </p>
      </div>
      <div className="text-xs text-ink-dim">.XLS, .XLSX, or .PDF — max 25MB</div>
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx,.pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}