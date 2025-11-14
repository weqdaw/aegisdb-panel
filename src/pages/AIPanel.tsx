import { type CSSProperties, type DragEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DatasetUploader, ModelList, TrainingConsole } from "./AI";
import type { DatasetRecord } from "./AI/types";

const API_BASE = import.meta.env.VITE_AI_API_URL ?? "http://localhost:8000";
const DATASETS_ENDPOINT = `${API_BASE}/datasets`;

const resolveErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
};

type DatasetResponse = {
  id: string;
  name: string;
  description?: string | null;
  text_column: string;
  created_at?: string | null;
  original_filename?: string | null;
};

type ModelItem = {
  id: string;
  name: string;
  status: string;
  model_type?: string;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "32px clamp(24px, 4vw, 56px)",
  background: "linear-gradient(180deg, #f8fbff 0%, #eef3ff 100%)",
  display: "grid",
  gap: 32,
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const tabsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const graphButtonStyle: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  background: "linear-gradient(120deg, #1d4ed8, #2563eb)",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(37, 99, 235, 0.28)",
  transition: "transform 0.24s ease",
};

const tabButtonStyle = (active: boolean): CSSProperties => ({
  padding: "10px 18px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  background: active ? "#0f172a" : "rgba(15, 23, 42, 0.08)",
  color: active ? "#ffffff" : "#0f172a",
  boxShadow: active ? "0 8px 18px rgba(15, 23, 42, 0.25)" : "none",
  transition: "all 0.24s ease",
});

const layoutStyle: CSSProperties = {
  display: "grid",
  gap: 32,
  gridTemplateColumns: "minmax(260px, 320px) 1fr",
  alignItems: "start",
};

const singleColumnStyle: CSSProperties = {
  display: "grid",
  gap: 24,
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
  padding: "24px 28px",
  display: "grid",
  gap: 20,
};

const subtleCardStyle: CSSProperties = {
  ...cardStyle,
  boxShadow: "0 16px 32px rgba(15, 23, 42, 0.06)",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const summaryCardStyle: CSSProperties = {
  padding: "18px 20px",
  borderRadius: 14,
  border: "1px solid rgba(148, 163, 184, 0.22)",
  background:
    "linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0%, rgba(226, 232, 240, 0.35) 100%)",
  display: "grid",
  gap: 6,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  color: "#0f172a",
  letterSpacing: "0.01em",
};

const tabs = [
  { id: "overview" as const, label: "基本概览" },
  { id: "workspace" as const, label: "AI 工作台" },
];

export default function AIPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("overview");
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [datasetsError, setDatasetsError] = useState<string | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [modelsVersion, setModelsVersion] = useState(0);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [mountedModelIds, setMountedModelIds] = useState<string[]>([]);
  const [activeMountedId, setActiveMountedId] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState("");

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const resp = await fetch(DATASETS_ENDPOINT);
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        const data = (await resp.json()) as DatasetResponse[];
        const normalized = data.map<DatasetRecord>((item) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? null,
          textColumn: item.text_column,
          createdAt: item.created_at ?? null,
          originalFilename: item.original_filename ?? null,
        }));
        setDatasets(normalized);
        setDatasetsError(null);
        setSelectedDatasetId((prev) => prev || (normalized[0]?.id ?? ""));
      } catch (err) {
        setDatasets([]);
        setDatasetsError(resolveErrorMessage(err, "加载数据集列表失败"));
      }
    };

    fetchDatasets();
  }, []);

  useEffect(() => {
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const resp = await fetch(`${API_BASE}/models`);
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        const data = (await resp.json()) as ModelItem[];
        setModels(data);
      } catch (err) {
        setModels([]);
        setModelsError(resolveErrorMessage(err, "加载模型列表失败，请稍后重试。"));
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, [modelsVersion]);

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.id === selectedDatasetId),
    [datasets, selectedDatasetId],
  );

  const summaryCards = useMemo(() => {
    return [
      {
        title: "已上传数据集",
        value: datasets.length,
        hint:
          datasets
            .slice(0, 3)
            .map((item) => item.name || item.id)
            .join("、") || "尚无数据集",
      },
      {
        title: "最近训练数据集",
        value: selectedDataset?.name || selectedDataset?.id || "未选择",
        hint: selectedDataset ? `ID：${selectedDataset.id}` : "可在训练台直接修改",
      },
      {
        title: "模型记录刷新次数",
        value: modelsVersion,
        hint: "训练完成或上传成功会自动刷新",
      },
    ];
  }, [datasets, selectedDataset, modelsVersion]);

  const mountedModels = useMemo(
    () => mountedModelIds.map((id) => models.find((item) => item.id === id)).filter(Boolean) as ModelItem[],
    [mountedModelIds, models],
  );

  const filteredModels = useMemo(() => {
    const keyword = modelFilter.trim().toLowerCase();
    return models.filter(
      (item) =>
        !mountedModelIds.includes(item.id) &&
        (keyword.length === 0 ||
          item.name.toLowerCase().includes(keyword) ||
          item.id.toLowerCase().includes(keyword) ||
          (item.model_type ?? "").toLowerCase().includes(keyword)),
    );
  }, [models, mountedModelIds, modelFilter]);

  const handleModelDragStart = (evt: DragEvent<HTMLLIElement>, id: string) => {
    evt.dataTransfer.setData("application/model-id", id);
    evt.dataTransfer.effectAllowed = "move";
  };

  const handleMountedDrop = (evt: DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    const id = evt.dataTransfer.getData("application/model-id");
    if (!id) return;
    setMountedModelIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    setActiveMountedId(id);
  };

  const allowDrop = (evt: DragEvent) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "move";
  };

  const handleMountedRemove = (id: string) => {
    setMountedModelIds((prev) => prev.filter((item) => item !== id));
    setActiveMountedId((prev) => (prev === id ? null : prev));
  };

  const handleMountedSelect = (id: string) => {
    setActiveMountedId((prev) => (prev === id ? null : id));
  };

  const handleUploaded = (dataset: DatasetRecord) => {
    setDatasets((prev) => {
      const filtered = prev.filter((item) => item.id !== dataset.id);
      return [dataset, ...filtered];
    });
    setDatasetsError(null);
    setSelectedDatasetId(dataset.id);
  };

  const handleTrainingFinished = () => {
    setModelsVersion((prev) => prev + 1);
  };

  const handleDatasetRemember = (dataset: DatasetRecord) => {
    if (!dataset?.id) return;
    setDatasets((prev) => {
      const filtered = prev.filter((item) => item.id !== dataset.id);
      return [dataset, ...filtered];
    });
    setSelectedDatasetId(dataset.id);
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, color: "#0f172a" }}>AI 面板</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <nav style={tabsStyle}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={tabButtonStyle(activeTab === tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => navigate("/ai/graph")}
            style={graphButtonStyle}
          >
            语义索引图谱
          </button>
        </div>
      </header>

      {activeTab === "overview" && (
        <>
          <div style={layoutStyle}>
          <aside style={{ display: "grid", gap: 24 }}>
            <section style={subtleCardStyle}>
              <h2 style={{ ...sectionTitleStyle, fontSize: 18 }}>数据概览</h2>
              <div style={summaryGridStyle}>
                {summaryCards.map((card) => (
                  <div key={card.title} style={summaryCardStyle}>
                    <span style={{ fontSize: 13, color: "#6b7280", letterSpacing: "0.02em" }}>
                      {card.title}
                    </span>
                    <strong style={{ fontSize: 22, color: "#0f172a" }}>{card.value}</strong>
                    <span style={{ fontSize: 13, color: "#475569" }}>{card.hint}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <main style={singleColumnStyle}>
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={sectionTitleStyle}>挂载模型</h2>
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" defaultChecked />
                    自动热更新
                  </label>
                  <label style={{ fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" />
                    允许实验版本
                  </label>
                </div>
              </div>

              <div
                onDragOver={allowDrop}
                onDrop={handleMountedDrop}
                style={{
                  border: "2px dashed rgba(37, 99, 235, 0.45)",
                  borderRadius: 14,
                  padding: 24,
                  minHeight: 160,
                  display: "grid",
                  gap: 16,
                  background: "rgba(59, 130, 246, 0.05)",
                }}
              >
                {mountedModels.length === 0 && (
                  <p style={{ margin: 0, color: "#64748b" }}>将下方模型拖拽到此处进行挂载。</p>
                )}
                {mountedModels.map((model) => {
                  const active = model.id === activeMountedId;
                  return (
                    <div
                      key={model.id}
                      style={{
                        border: active ? "2px solid #2563eb" : "1px solid rgba(148, 163, 184, 0.35)",
                        borderRadius: 12,
                        padding: 16,
                        background: active ? "#ffffff" : "rgba(255, 255, 255, 0.85)",
                        display: "grid",
                        gap: 10,
                        boxShadow: active ? "0 12px 32px rgba(37, 99, 235, 0.18)" : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#0f172a", fontSize: 16 }}>{model.name}</strong>
                          <div style={{ color: "#475569", fontSize: 13 }}>
                            类型：{model.model_type ?? "未知"} · 状态：{model.status}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleMountedSelect(model.id)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "1px solid rgba(37, 99, 235, 0.45)",
                              background: active ? "#2563eb" : "#ffffff",
                              color: active ? "#ffffff" : "#2563eb",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {active ? "配置中" : "配置"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMountedRemove(model.id)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "1px solid rgba(239, 68, 68, 0.45)",
                              background: "#ffffff",
                              color: "#ef4444",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            移除
                          </button>
                        </div>
                      </div>
                      {active && (
                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            padding: 12,
                            borderRadius: 10,
                            background: "rgba(226, 232, 240, 0.6)",
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <span style={{ color: "#0f172a", fontSize: 13 }}>推理并发限制</span>
                            <select
                              defaultValue="auto"
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid rgba(148, 163, 184, 0.45)",
                                fontSize: 13,
                              }}
                              aria-label="推理并发限制"
                            >
                              <option value="auto">自动</option>
                              <option value="low">低（2 并发）</option>
                              <option value="medium">中等（8 并发）</option>
                              <option value="high">高（16 并发）</option>
                            </select>
                          </label>
                          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#0f172a", fontSize: 13 }}>启用指标上报</span>
                            <input type="checkbox" defaultChecked />
                          </label>
                          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#0f172a", fontSize: 13 }}>容错重试次数</span>
                            <input
                              type="number"
                              min={0}
                              defaultValue={3}
                              style={{
                                width: 80,
                                padding: "6px 8px",
                                borderRadius: 8,
                                border: "1px solid rgba(148, 163, 184, 0.45)",
                                fontSize: 13,
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            style={{
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: "none",
                              background: "linear-gradient(120deg, #10b981, #059669)",
                              color: "#ffffff",
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            保存配置
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <h2 style={sectionTitleStyle}>模型列表</h2>
                <input
                  value={modelFilter}
                  onChange={(evt) => setModelFilter(evt.target.value)}
                  placeholder="搜索名称 / ID / 类型"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(148, 163, 184, 0.45)",
                    background: "#ffffff",
                    minWidth: 180,
                    fontSize: 14,
                  }}
                />
              </div>
              {modelsLoading && (
                <p style={{ margin: 0, color: "#64748b" }}>模型加载中...</p>
              )}
              {modelsError && (
                <p style={{ margin: 0, color: "#ef4444" }}>{modelsError}</p>
              )}
              {!modelsLoading && !modelsError && filteredModels.length === 0 && (
                <p style={{ margin: 0, color: "#64748b" }}>暂无可挂载模型。</p>
              )}
              <ul style={{ display: "grid", gap: 12, padding: 0, listStyle: "none" }}>
                {filteredModels.map((model) => (
                  <li
                    key={model.id}
                    draggable
                    onDragStart={(evt) => handleModelDragStart(evt, model.id)}
                    style={{
                      border: "1px solid rgba(148, 163, 184, 0.35)",
                      borderRadius: 14,
                      padding: 16,
                      background: "#f8fafc",
                      display: "grid",
                      gap: 6,
                      cursor: "grab",
                    }}
                  >
                    <strong style={{ color: "#0f172a", fontSize: 15 }}>{model.name}</strong>
                    <span style={{ color: "#475569", fontSize: 13 }}>类型：{model.model_type ?? "未知"}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>拖拽至上方区域进行挂载</span>
                  </li>
                ))}
              </ul>
            </section>
          </main>
          </div>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>预测命中率</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid rgba(148, 163, 184, 0.25)",
                background: "linear-gradient(120deg, rgba(59, 130, 246, 0.1), rgba(96, 165, 250, 0.05))",
              }}
            >
              <div>
                <strong style={{ color: "#0f172a", fontSize: 16 }}>智能缓存预测</strong>
                <p style={{ margin: "4px 0 0", color: "#475569", fontSize: 13 }}>最近 24 小时命中趋势稳定，主要覆盖热点查询场景</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: 28, fontWeight: 700, color: "#2563eb" }}>92.4%</span>
                <span style={{ color: "#16a34a", fontSize: 12 }}>较昨日 +1.2%</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid rgba(148, 163, 184, 0.25)",
                background: "linear-gradient(120deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.05))",
              }}
            >
              <div>
                <strong style={{ color: "#0f172a", fontSize: 16 }}>热点 Key 预测</strong>
                <p style={{ margin: "4px 0 0", color: "#475569", fontSize: 13 }}>高频写热点识别准确，缓存击穿风险可控</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: 28, fontWeight: 700, color: "#059669" }}>88.6%</span>
                <span style={{ color: "#16a34a", fontSize: 12 }}>较上周 +0.8%</span>
              </div>
            </div>
          </div>
        </section>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>模型性能评估</h2>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(148, 163, 184, 0.22)",
                background: "rgba(59, 130, 246, 0.08)",
              }}
            >
              <span style={{ color: "#1d4ed8", fontSize: 13, letterSpacing: "0.02em" }}>平均延迟</span>
              <strong style={{ display: "block", fontSize: 26, color: "#0f172a", marginTop: 6 }}>38 ms</strong>
              <span style={{ color: "#475569", fontSize: 12 }}>P95：65 ms</span>
            </div>
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(148, 163, 184, 0.22)",
                background: "rgba(16, 185, 129, 0.08)",
              }}
            >
              <span style={{ color: "#047857", fontSize: 13, letterSpacing: "0.02em" }}>吞吐量</span>
              <strong style={{ display: "block", fontSize: 26, color: "#0f172a", marginTop: 6 }}>312 QPS</strong>
              <span style={{ color: "#475569", fontSize: 12 }}>峰值：486 QPS</span>
            </div>
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(148, 163, 184, 0.22)",
                background: "rgba(248, 113, 113, 0.1)",
              }}
            >
              <span style={{ color: "#b91c1c", fontSize: 13, letterSpacing: "0.02em" }}>错误率</span>
              <strong style={{ display: "block", fontSize: 26, color: "#0f172a", marginTop: 6 }}>0.96%</strong>
              <span style={{ color: "#475569", fontSize: 12 }}>目标：≤ 1%</span>
            </div>
          </div>
        </section>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>告警与异常</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
            {[
              {
                title: "缓存预取延迟抖动",
                detail: "08:42 自动修复完成，原因：短暂网络拥塞",
                levelColor: "#f97316",
              },
              {
                title: "热点 Key 预测误差提醒",
                detail: "07:15 已触发额外训练任务，预计 30 分钟内完成",
                levelColor: "#2563eb",
              },
              {
                title: "模型服务实例重启",
                detail: "06:58 重启 1 次，运行状态正常，无请求丢失",
                levelColor: "#16a34a",
              },
            ].map((item) => (
              <li
                key={item.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  background: "rgba(255, 255, 255, 0.9)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 40,
                    borderRadius: 4,
                    background: item.levelColor,
                    display: "inline-block",
                  }}
                />
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ color: "#0f172a", fontSize: 14 }}>{item.title}</strong>
                  <span style={{ color: "#475569", fontSize: 12 }}>{item.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
        </>
      )}

      {activeTab === "workspace" && (
        <main style={singleColumnStyle}>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>数据集管理</h2>
            <DatasetUploader onUploaded={handleUploaded} />
            {datasetsError && (
              <p style={{ margin: "6px 0 0", color: "#ef4444", fontSize: 14 }}>{datasetsError}</p>
            )}
            {datasets.length > 0 && (
              <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 14 }}>
                最近上传：{datasets[0].name || datasets[0].id}
              </p>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>训练平台</h2>
            <TrainingConsole
              defaultDatasetId={selectedDatasetId}
              datasets={datasets}
              onFinished={handleTrainingFinished}
              onDatasetRemember={handleDatasetRemember}
            />
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>模型列表与管理</h2>
            <ModelList refreshKey={modelsVersion} />
          </section>
        </main>
      )}
    </div>
  );
}