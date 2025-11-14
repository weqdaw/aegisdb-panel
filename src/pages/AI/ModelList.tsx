import { type CSSProperties, useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_AI_API_URL ?? "http://localhost:8000";
const MODELS_ENDPOINT = `${API_BASE}/models`;
const MODEL_UPLOAD_ENDPOINT = `${API_BASE}/models/upload`;

type ModelItem = {
  id: string;
  name: string;
  status: string;
  model_type?: string;
  created_at?: string;
  download_url: string;
  artifact_path?: string | null;
  metrics?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type Props = {
  refreshKey: number;
};

type UploadState = {
  file: File | null;
  name: string;
  modelType: string;
  description: string;
};

const resolveErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
};

export function ModelList({ refreshKey }: Props) {
  const [items, setItems] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadState>({
    file: null,
    name: "",
    modelType: "embedding",
    description: "",
  });

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(MODELS_ENDPOINT);
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        const data = (await resp.json()) as ModelItem[];
        setItems(data);
      } catch (err) {
        setError(
          resolveErrorMessage(err, "加载模型列表失败，请确认后端 /models 路由是否启用。"),
        );
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return items;
    const keyword = filter.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword) ||
        (item.model_type ?? "").toLowerCase().includes(keyword)
    );
  }, [items, filter]);

  const handleUploadChange = (patch: Partial<UploadState>) => {
    setUploadForm((prev) => ({ ...prev, ...patch }));
  };

  const handleUploadSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!uploadForm.file) {
      setUploadError("请选择模型文件（例如 zip / safetensors / bin）");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const form = new FormData();
      form.append("file", uploadForm.file);
      form.append("name", uploadForm.name || uploadForm.file.name);
      form.append("model_type", uploadForm.modelType);
      form.append("description", uploadForm.description);
      const resp = await fetch(MODEL_UPLOAD_ENDPOINT, {
        method: "POST",
        body: form,
      });

      if (!resp.ok) {
        throw new Error(await resp.text());
      }

      const data = (await resp.json()) as ModelItem;
      setUploadSuccess(`模型上传成功：${data?.id ?? uploadForm.name}`);
      setUploadForm({
        file: null,
        name: "",
        modelType: "embedding",
        description: "",
      });
      // 主动刷新
      setItems((prev) => [data, ...prev]);
    } catch (err) {
      setUploadError(resolveErrorMessage(err, "上传模型失败，请确认后端已实现 /models/upload 接口。"));
    } finally {
      setUploading(false);
    }
  };

  if (loading && items.length === 0) return <p>加载中...</p>;

  const uploadCardStyle: CSSProperties = {
    border: "1px solid rgba(148, 163, 184, 0.35)",
    padding: 24,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(59, 130, 246, 0.12) 100%)",
    display: "grid",
    gap: 16,
  };

  const labelStyle: CSSProperties = {
    display: "grid",
    gap: 10,
    fontSize: 14,
    color: "#1e293b",
    fontWeight: 500,
  };

  const controlStyle: CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(148, 163, 184, 0.45)",
    background: "#ffffff",
    fontSize: 14,
  };

  const textareaStyle: CSSProperties = {
    ...controlStyle,
    minHeight: 96,
    resize: "vertical",
  };

  const submitStyle: CSSProperties = {
    padding: "12px 18px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(120deg, #3b82f6, #2563eb)",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  };

  const listItemStyle: CSSProperties = {
    border: "1px solid rgba(148, 163, 184, 0.3)",
    borderRadius: 16,
    padding: 20,
    background: "#ffffff",
    display: "grid",
    gap: 10,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={uploadCardStyle}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>上传自定义模型</h3>
          <p style={{ margin: "8px 0 0", color: "#0f172a", fontSize: 14, opacity: 0.75 }}>
          上传模型产物（如训练导出的 zip 或权重文件），后端需提供 POST /models/upload 接口来保存文件与记录。
        </p>
        </div>
        <form
          onSubmit={handleUploadSubmit}
          style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          <label style={labelStyle}>
            模型文件
            <input
              style={{ ...controlStyle, padding: "10px 14px" }}
              type="file"
              onChange={(e) => handleUploadChange({ file: e.target.files?.[0] ?? null })}
            />
            {uploadForm.file && (
              <small style={{ color: "#0f172a", opacity: 0.7 }}>
                {uploadForm.file.name} · {(uploadForm.file.size / 1024).toFixed(1)} KB
              </small>
            )}
          </label>

          <label style={labelStyle}>
            模型名称
            <input
              style={controlStyle}
              value={uploadForm.name}
              onChange={(e) => handleUploadChange({ name: e.target.value })}
              placeholder="用于展示的名称"
            />
          </label>

          <label style={labelStyle}>
            模型类型
            <select
              style={controlStyle}
              value={uploadForm.modelType}
              onChange={(e) => handleUploadChange({ modelType: e.target.value })}
            >
              <option value="embedding">文本向量</option>
              <option value="ml">传统机器学习</option>
              <option value="lstm">LSTM</option>
              <option value="rl">强化学习</option>
              <option value="custom">自定义</option>
            </select>
          </label>

          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
            描述备注
            <textarea
              style={textareaStyle}
              rows={3}
              value={uploadForm.description}
              onChange={(e) => handleUploadChange({ description: e.target.value })}
              placeholder="说明该模型的来源、用途或评估结果"
            />
          </label>

          <button
            type="submit"
            disabled={uploading}
            style={{
              ...submitStyle,
              gridColumn: "1 / -1",
              opacity: uploading ? 0.7 : 1,
              boxShadow: uploading ? "none" : "0 16px 24px rgba(37, 99, 235, 0.25)",
            }}
          >
            {uploading ? "上传中..." : "上传模型"}
          </button>

          {uploadError && (
            <p style={{ color: "#ef4444", gridColumn: "1 / -1", margin: 0 }}>{uploadError}</p>
          )}
          {uploadSuccess && (
            <p style={{ color: "#16a34a", gridColumn: "1 / -1", margin: 0 }}>{uploadSuccess}</p>
          )}
        </form>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>模型列表</h3>
          <input
            value={filter}
            placeholder="输入名称 / ID / 类型过滤"
            onChange={(e) => setFilter(e.target.value)}
            style={{
              ...controlStyle,
              flex: 1,
              minWidth: 220,
              maxWidth: 320,
              background: "#f8fafc",
            }}
          />
        </div>

        {error && <p style={{ color: "#ef4444" }}>{error}</p>}
        {!error && filtered.length === 0 && (
          <p style={{ color: "#64748b", marginTop: 8 }}>暂无模型记录。</p>
        )}

        <ul style={{ display: "grid", gap: 12, padding: 0, listStyle: "none" }}>
          {filtered.map((item) => (
            <li
              key={item.id}
              style={{
                ...listItemStyle,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 16, color: "#0f172a" }}>{item.name}</div>
              <div style={{ color: "#475569" }}>模型 ID：{item.id}</div>
              <div style={{ color: "#475569" }}>类型：{item.model_type ?? "未知"}</div>
              <div style={{ color: "#475569" }}>状态：{item.status}</div>
              {item.created_at && (
                <div style={{ color: "#475569" }}>
                  时间：{new Date(item.created_at).toLocaleString()}
                </div>
              )}
              {item.artifact_path && (
                <div style={{ color: "#475569" }}>文件路径：{item.artifact_path}</div>
              )}
              {item.metrics && (
                <details>
                  <summary>指标</summary>
                  <pre style={{ margin: 0 }}>{JSON.stringify(item.metrics, null, 2)}</pre>
                </details>
              )}
              {item.metadata && (
                <details>
                  <summary>元数据</summary>
                  <pre style={{ margin: 0 }}>{JSON.stringify(item.metadata, null, 2)}</pre>
                </details>
              )}
              <a
                href={`${API_BASE}${item.download_url}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: 4,
                  color: "#2563eb",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                下载模型
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}