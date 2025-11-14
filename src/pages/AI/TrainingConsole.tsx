import { type CSSProperties, useEffect, useMemo, useState } from "react";
import type { DatasetRecord } from "./types";

const API_BASE = import.meta.env.VITE_AI_API_URL ?? "http://localhost:8000";
const TRAIN_ENDPOINT = `${API_BASE}/train/train`;

const MODEL_TYPES = [
  { value: "embedding", label: "文本向量 (SentenceTransformer)" },
  { value: "ml", label: "传统机器学习" },
  { value: "lstm", label: "LSTM 序列模型" },
  { value: "rl", label: "强化学习" },
];

type Status = {
  status: string;
  progress: number;
  logs: string[];
  output_path?: string | null;
};

type HyperParams = {
  embedding_dim?: number;
  hidden_size?: number;
  num_layers?: number;
  [key: string]: number | undefined;
};

type TrainingParams = {
  epochs?: number;
  batch_size?: number;
  learning_rate?: number;
  episodes?: number;
  algorithm?: string;
  dropout?: number;
  [key: string]: number | string | boolean | undefined;
};

type AugmentationConfig = {
  enabled?: boolean;
  techniques?: unknown[];
  [key: string]: unknown;
};

type FormState = {
  datasetId: string;
  modelType: string;
  modelName: string;
  validationSplit: number;
  hyperparams: HyperParams;
  trainingParams: TrainingParams;
  dataAugmentation: AugmentationConfig;
  hardware: {
    use_gpu: boolean;
    gpu_device?: string;
  };
};

const DEFAULT_FORM: FormState = {
  datasetId: "",
  modelType: "embedding",
  modelName: "sentence-transformers/all-MiniLM-L6-v2",
  validationSplit: 10,
  hyperparams: {
    embedding_dim: 384,
    hidden_size: 256,
    num_layers: 2,
  },
  trainingParams: {
    epochs: 1,
    batch_size: 16,
    learning_rate: 2e-5,
    episodes: 8,
    algorithm: "PPO",
  },
  dataAugmentation: {
    enabled: false,
    techniques: [],
  },
  hardware: {
    use_gpu: false,
  },
};

type Props = {
  defaultDatasetId?: string;
  datasets?: DatasetRecord[];
  onFinished?: () => void;
  onDatasetRemember?: (dataset: DatasetRecord) => void;
};

const resolveErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
};

function useStatus(jobId: string | null, onFinished?: () => void) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const resp = await fetch(`${TRAIN_ENDPOINT}/${jobId}`);
        if (!resp.ok) throw new Error(await resp.text());
        const data = (await resp.json()) as Status;
        if (!cancelled) {
          setStatus(data);
          if (data.status === "completed" || data.status === "failed") {
            onFinished?.();
          } else {
            setTimeout(poll, 2000);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(resolveErrorMessage(err, "查询训练状态失败"));
        }
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, onFinished]);

  return { status, error, setError, setStatus };
}

const consoleLayoutStyle: CSSProperties = {
  display: "grid",
  gap: 24,
};

const sectionGridStyle: CSSProperties = {
  display: "grid",
  gap: 20,
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const fieldGroupStyle: CSSProperties = {
  display: "grid",
  gap: 18,
};

const datasetInfoStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "#f8fafc",
  padding: "12px 14px",
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#475569",
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
};

const numericStyle: CSSProperties = {
  ...controlStyle,
  width: "100%",
  appearance: "textfield",
};

const switchCardStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.3)",
  background: "rgba(241, 245, 249, 0.65)",
  padding: 18,
  display: "grid",
  gap: 12,
};

const buttonStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(120deg, #22c55e, #16a34a)",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
};

const statusCardStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.3)",
  background: "#f1f5f9",
  padding: 20,
  display: "grid",
  gap: 12,
};

export function TrainingConsole({
  defaultDatasetId = "",
  datasets = [],
  onFinished,
  onDatasetRemember,
}: Props) {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, datasetId: defaultDatasetId });
  const [jobId, setJobId] = useState<string | null>(null);
  const { status, error, setError, setStatus } = useStatus(jobId, onFinished);
  const [loading, setLoading] = useState(false);
  const [augmentationDraft, setAugmentationDraft] = useState(JSON.stringify(DEFAULT_FORM.dataAugmentation, null, 2));

  const datasetOptions = useMemo(
    () =>
      datasets.map((item) => ({
        value: item.id,
        label: item.name ? `${item.name}（${item.id.slice(0, 8)}）` : item.id,
      })),
    [datasets],
  );

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.id === form.datasetId),
    [datasets, form.datasetId],
  );

  useEffect(() => {
    if (datasets.length === 0) {
      if (form.datasetId) {
        setForm((prev) => ({ ...prev, datasetId: "" }));
      }
      return;
    }

    const hasCurrent = datasets.some((item) => item.id === form.datasetId);
    if (hasCurrent) return;

    const preferred =
      (defaultDatasetId && datasets.find((item) => item.id === defaultDatasetId)?.id) ??
      datasets[0]?.id ??
      "";

    if (preferred && preferred !== form.datasetId) {
      setForm((prev) => ({ ...prev, datasetId: preferred }));
      const matched = datasets.find((item) => item.id === preferred);
      if (matched) {
        onDatasetRemember?.(matched);
      }
    } else if (!preferred && form.datasetId) {
      setForm((prev) => ({ ...prev, datasetId: "" }));
    }
  }, [datasets, defaultDatasetId, form.datasetId, onDatasetRemember]);

  const visibleFields = useMemo(() => {
    switch (form.modelType) {
      case "embedding":
        return ["modelName", "epochs", "batch_size", "embedding_dim"];
      case "ml":
        return ["epochs", "batch_size"];
      case "lstm":
        return ["epochs", "learning_rate", "hidden_size", "num_layers", "dropout"];
      case "rl":
        return ["episodes", "algorithm", "learning_rate"];
      default:
        return [];
    }
  }, [form.modelType]);

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDatasetSelect = (datasetId: string) => {
    setForm((prev) => ({ ...prev, datasetId }));
    const matched = datasets.find((item) => item.id === datasetId);
    if (matched) {
      onDatasetRemember?.(matched);
    }
  };

  const handleTrainingParamChange = <K extends keyof TrainingParams>(
    key: K,
    value: TrainingParams[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      trainingParams: { ...prev.trainingParams, [key]: value },
    }));
  };

  const handleHyperParamChange = <K extends keyof HyperParams>(
    key: K,
    value: HyperParams[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      hyperparams: { ...prev.hyperparams, [key]: value },
    }));
  };

  const handleAugmentationChange = (value: string) => {
    setAugmentationDraft(value);
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("parsed value is not a plain object");
      }
      handleChange("dataAugmentation", parsed as AugmentationConfig);
      setError(null);
    } catch {
      setError("数据增强 JSON 无法解析");
    }
  };

  const handleStart = async () => {
    const trimmedDatasetId = form.datasetId.trim();
    if (!trimmedDatasetId) {
      setError("请先选择一个数据集");
      return;
    }

    setError(null);
    setStatus(null);
    setJobId(null);
    setLoading(true);
    try {
      const resp = await fetch(TRAIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: trimmedDatasetId,
          modelType: form.modelType,
          modelName: form.modelName,
          validationSplit: form.validationSplit,
          hyperparams: form.hyperparams,
          trainingParams: form.trainingParams,
          hardware: form.hardware,
          dataAugmentation: form.dataAugmentation,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      type TrainStartResponse = { job_id: string };
      const data = (await resp.json()) as TrainStartResponse;
      setJobId(data.job_id);
    } catch (err) {
      setError(resolveErrorMessage(err, "训练启动失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={consoleLayoutStyle}>
      <div style={sectionGridStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>
            选择数据集
            <select
              style={controlStyle}
              value={form.datasetId}
              onChange={(e) => handleDatasetSelect(e.target.value)}
              disabled={datasets.length === 0}
            >
              <option value="">
                {datasets.length === 0 ? "暂无可用数据集，请先上传" : "请选择数据集"}
              </option>
              {datasetOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {selectedDataset && (
            <div style={datasetInfoStyle}>
              <span>标识：{selectedDataset.id}</span>
              <span>文本列：{selectedDataset.textColumn}</span>
              {selectedDataset.description && <span>描述：{selectedDataset.description}</span>}
              {selectedDataset.originalFilename && (
                <span>文件名：{selectedDataset.originalFilename}</span>
              )}
            </div>
          )}

          {datasets.length === 0 && (
            <p style={{ color: "#ef4444", margin: 0, fontSize: 13 }}>
              未检测到持久化数据集，请先在上方上传一个。
            </p>
          )}

          <label style={labelStyle}>
            验证集比例（%）
            <input
              style={numericStyle}
              type="number"
              min={0}
              max={50}
              value={form.validationSplit}
              onChange={(e) => handleChange("validationSplit", Number(e.target.value))}
            />
          </label>

          <div style={switchCardStyle}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.hardware.use_gpu}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    hardware: { ...prev.hardware, use_gpu: e.target.checked },
                  }))
                }
              />
              使用 GPU
            </label>

            {form.hardware.use_gpu && (
              <label style={{ ...labelStyle, margin: 0 }}>
                GPU 设备
                <input
                  style={controlStyle}
                  value={form.hardware.gpu_device ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      hardware: { ...prev.hardware, gpu_device: e.target.value },
                    }))
                  }
                  placeholder="如 cuda:0"
                />
              </label>
            )}
          </div>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>
            模型类型
            <select
              style={controlStyle}
              value={form.modelType}
              onChange={(e) => handleChange("modelType", e.target.value)}
            >
              {MODEL_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {form.modelType === "embedding" && (
            <label style={labelStyle}>
              基座模型
              <input
                style={controlStyle}
                value={form.modelName}
                onChange={(e) => handleChange("modelName", e.target.value)}
                placeholder="sentence-transformers/all-MiniLM-L6-v2"
              />
            </label>
          )}

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            {visibleFields.includes("epochs") && (
              <label style={labelStyle}>
                Epochs
                <input
                  style={numericStyle}
                  type="number"
                  min={1}
                  value={form.trainingParams.epochs ?? 1}
                  onChange={(e) => handleTrainingParamChange("epochs", Number(e.target.value))}
                />
              </label>
            )}
            {visibleFields.includes("batch_size") && (
              <label style={labelStyle}>
                Batch Size
                <input
                  style={numericStyle}
                  type="number"
                  min={1}
                  value={form.trainingParams.batch_size ?? 16}
                  onChange={(e) => handleTrainingParamChange("batch_size", Number(e.target.value))}
                />
              </label>
            )}
            {visibleFields.includes("learning_rate") && (
              <label style={labelStyle}>
                Learning Rate
                <input
                  style={numericStyle}
                  type="number"
                  step="0.00001"
                  value={form.trainingParams.learning_rate ?? 0.001}
                  onChange={(e) => handleTrainingParamChange("learning_rate", Number(e.target.value))}
                />
              </label>
            )}
            {visibleFields.includes("episodes") && (
              <label style={labelStyle}>
                Episodes
                <input
                  style={numericStyle}
                  type="number"
                  min={1}
                  value={form.trainingParams.episodes ?? 8}
                  onChange={(e) => handleTrainingParamChange("episodes", Number(e.target.value))}
                />
              </label>
            )}
            {visibleFields.includes("algorithm") && (
              <label style={labelStyle}>
                Algorithm
                <input
                  style={controlStyle}
                  value={form.trainingParams.algorithm ?? "PPO"}
                  onChange={(e) => handleTrainingParamChange("algorithm", e.target.value)}
                />
              </label>
            )}
            {visibleFields.includes("hidden_size") && (
              <label style={labelStyle}>
                Hidden Size
                <input
                  style={numericStyle}
                  type="number"
                  min={64}
                  value={form.hyperparams.hidden_size ?? 256}
                  onChange={(e) => handleHyperParamChange("hidden_size", Number(e.target.value))}
                />
              </label>
            )}
            {visibleFields.includes("num_layers") && (
              <label style={labelStyle}>
                LSTM Layers
                <input
                  style={numericStyle}
                  type="number"
                  min={1}
                  value={form.hyperparams.num_layers ?? 2}
                  onChange={(e) => handleHyperParamChange("num_layers", Number(e.target.value))}
                />
              </label>
            )}
            {visibleFields.includes("dropout") && (
              <label style={labelStyle}>
                Dropout
                <input
                  style={numericStyle}
                  type="number"
                  step="0.05"
                  value={form.trainingParams.dropout ?? 0.1}
                  onChange={(e) => handleTrainingParamChange("dropout", Number(e.target.value))}
                />
              </label>
            )}
            {visibleFields.includes("embedding_dim") && (
              <label style={labelStyle}>
                向量维度
                <input
                  style={numericStyle}
                  type="number"
                  min={64}
                  value={form.hyperparams.embedding_dim ?? 384}
                  onChange={(e) => handleHyperParamChange("embedding_dim", Number(e.target.value))}
                />
              </label>
            )}
          </div>

          <details
            style={{
              borderRadius: 14,
              border: "1px solid rgba(148, 163, 184, 0.4)",
              background: "#f8fafc",
              padding: 16,
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 600,
                color: "#2563eb",
              }}
            >
              高级设置
            </summary>
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label style={labelStyle}>
                数据增强策略（JSON）
                <textarea
                  style={{ ...controlStyle, fontFamily: "monospace", fontSize: 13, minHeight: 120 }}
                  rows={4}
                  value={augmentationDraft}
                  onChange={(e) => handleAugmentationChange(e.target.value)}
                />
              </label>
            </div>
          </details>
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={!!jobId || loading}
        style={{
          ...buttonStyle,
          opacity: !!jobId || loading ? 0.7 : 1,
          boxShadow: !!jobId || loading ? "none" : "0 16px 24px rgba(34, 197, 94, 0.25)",
        }}
      >
        {jobId ? "训练进行中..." : loading ? "启动中..." : "开始训练"}
      </button>

      {error && <p style={{ color: "#ef4444", margin: 0 }}>{error}</p>}

      {status && (
        <div style={statusCardStyle}>
          <div style={{ fontWeight: 600, color: "#0f172a" }}>状态：{status.status}</div>
          <div style={{ color: "#0f172a" }}>进度：{status.progress}%</div>
          <div style={{ display: "grid", gap: 8 }}>
            日志：
            <pre
              style={{
                margin: 0,
                background: "#0f172a",
                color: "#f8fafc",
                padding: 16,
                borderRadius: 12,
                maxHeight: 240,
                overflow: "auto",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {status.logs.join("\n")}
            </pre>
          </div>
          {status.output_path && (
            <div style={{ color: "#2563eb" }}>产物路径：{status.output_path}</div>
          )}
        </div>
      )}
    </div>
  );
}