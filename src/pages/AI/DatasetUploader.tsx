import { type CSSProperties, useMemo, useState } from "react";
import type { DatasetRecord } from "./types";

const API_BASE = import.meta.env.VITE_AI_API_URL ?? "http://localhost:8000";
const DATASET_ENDPOINT = `${API_BASE}/datasets`;

type Props = {
  onUploaded?: (dataset: DatasetRecord) => void;
};

type DatasetUploadResponse = {
  id: string;
  name: string;
  description?: string | null;
  text_column: string;
  created_at?: string | null;
  original_filename?: string | null;
};

const resolveErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  maxWidth: 680,
};

const helpTextStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  background: "linear-gradient(90deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0))",
  padding: "12px 14px",
  borderRadius: 12,
  fontSize: 14,
  lineHeight: 1.6,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#1e293b",
  fontWeight: 500,
  fontSize: 14,
};

const controlStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(148, 163, 184, 0.45)",
  background: "#f8fafc",
  fontSize: 14,
  transition: "border 0.2s ease, background 0.2s ease",
};

const fileHintStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const buttonStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(120deg, #2563eb, #1d4ed8)",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
};

export function DatasetUploader({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [textColumn, setTextColumn] = useState("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileHint = useMemo(() => {
    if (!file) return "尚未选择文件";
    return `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
  }, [file]);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!file) {
      setError("请选择要上传的文件");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", name || file.name);
      form.append("description", desc);
      form.append("text_column", textColumn || "text");

      const resp = await fetch(DATASET_ENDPOINT, {
        method: "POST",
        body: form,
      });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      const data = (await resp.json()) as DatasetUploadResponse;
      const datasetRecord: DatasetRecord = {
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        textColumn: data.text_column,
        createdAt: data.created_at ?? null,
        originalFilename: data.original_filename ?? null,
      };
      setSuccess(`上传成功，数据集 ID：${datasetRecord.id}`);
      onUploaded?.(datasetRecord);
      setName("");
      setDesc("");
      setTextColumn("text");
      setFile(null);
    } catch (err) {
      setError(resolveErrorMessage(err, "上传失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <p style={helpTextStyle}>
        支持 TXT / CSV / JSON / JSONL / TSV 等文本格式。
        上传后系统会记住该数据集，可直接在训练台中选择。
      </p>

      <label style={labelStyle}>
        名称
        <input
          style={controlStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="数据集名称（默认使用文件名）"
        />
      </label>

      <label style={labelStyle}>
        描述
        <input
          style={controlStyle}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="说明（可选）"
        />
      </label>

      <label style={labelStyle}>
        文本列名
        <input
          style={controlStyle}
          value={textColumn}
          onChange={(e) => setTextColumn(e.target.value)}
          placeholder="text"
        />
      </label>

      <label style={{ ...labelStyle, gap: 10 }}>
        数据文件
        <input
          style={{ ...controlStyle, padding: "10px 14px" }}
          type="file"
          accept=".txt,.csv,.jsonl,.json,.tsv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <small style={fileHintStyle}>{fileHint}</small>
      </label>

      <button
        type="submit"
        disabled={loading}
        style={{
          ...buttonStyle,
          opacity: loading ? 0.75 : 1,
          boxShadow: loading
            ? "none"
            : "0 14px 24px rgba(37, 99, 235, 0.25)",
        }}
      >
        {loading ? "上传中..." : "上传数据集"}
      </button>

      {error && (
        <p style={{ color: "#ef4444", margin: 0, fontSize: 14 }}>{error}</p>
      )}
      {success && (
        <p style={{ color: "#16a34a", margin: 0, fontSize: 14 }}>{success}</p>
      )}
    </form>
  );
}