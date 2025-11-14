import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createAndStoreApiKey,
  loadApiKey,
  markApiKeyViewed,
  type StoredApiKey,
} from "../utils/apiKeyManager";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "48px 24px",
  background:
    "radial-gradient(circle at top, rgba(59, 130, 246, 0.08) 0%, transparent 55%)",
  color: "#0f172a",
};

const cardStyle: CSSProperties = {
  width: "min(640px, 100%)",
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.08)",
  padding: "28px 32px",
  display: "grid",
  gap: 20,
};

const titleStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  margin: 0,
};

const descriptionStyle: CSSProperties = {
  color: "rgba(71, 85, 105, 0.88)",
  fontSize: 15,
  lineHeight: 1.6,
  margin: 0,
};

const keyPreviewStyle: CSSProperties = {
  fontFamily:
    "ui-monospace, SFMono-Regular, SFMono, Menlo, Consolas, Liberation Mono, monospace",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  padding: "16px 18px",
  borderRadius: 14,
  wordBreak: "break-all",
  fontSize: 14,
  border: "1px solid rgba(148, 163, 184, 0.28)",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
};

const buttonStyle: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  transition: "all 0.24s ease",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(120deg, #2563eb, #1d4ed8)",
  border: "none",
  color: "#ffffff",
  boxShadow: "0 14px 30px rgba(37, 99, 235, 0.24)",
};

export default function Settings() {
  const [apiKeyRecord, setApiKeyRecord] = useState<StoredApiKey | null>(null);
  const [displayedKey, setDisplayedKey] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const [copyMessage, setCopyMessage] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setApiKeyRecord(loadApiKey());
  }, []);

  useEffect(() => {
    if (apiKeyRecord && !apiKeyRecord.viewed) {
      setDisplayedKey(apiKeyRecord.key);
      const updated = markApiKeyViewed();
      if (updated) {
        setApiKeyRecord(updated);
      }
    } else if (!apiKeyRecord?.viewed) {
      setDisplayedKey(null);
    }
  }, [apiKeyRecord]);

  const createdAtLabel = useMemo(() => {
    if (!apiKeyRecord?.createdAt) return null;
    try {
      return new Date(apiKeyRecord.createdAt).toLocaleString();
    } catch {
      return apiKeyRecord.createdAt;
    }
  }, [apiKeyRecord?.createdAt]);

  const handleGenerate = () => {
    if (typeof window === "undefined") return;
    if (apiKeyRecord) {
      const confirmation = window.confirm(
        "重新生成后旧的 API Key 将立即失效，确认继续？"
      );
      if (!confirmation) return;
    }
    const record = createAndStoreApiKey();
    setApiKeyRecord(record);
    setDisplayedKey(record.key);
  };

  const handleCopy = async () => {
    if (!displayedKey) return;
    try {
      await navigator.clipboard.writeText(displayedKey);
      setCopyState("copied");
      setCopyMessage("已复制到剪贴板");
      window.setTimeout(() => {
        setCopyState("idle");
        setCopyMessage("");
      }, 2400);
    } catch (err) {
      setCopyState("error");
      setCopyMessage((err as Error).message ?? "复制失败");
      window.setTimeout(() => {
        setCopyState("idle");
        setCopyMessage("");
      }, 3200);
    }
  };

  return (
    <div style={pageStyle}>
      <section style={cardStyle}>
        <div>
          <h1 style={titleStyle}>安全设置</h1>
          <p style={descriptionStyle}>
            管理用于配置中心二次认证的 API Key。请妥善保存，该密钥仅在生成时展示一次，遗失后需要重新生成。
          </p>
        </div>

        {displayedKey ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(59, 130, 246, 0.9)",
                  letterSpacing: 0.3,
                }}
              >
                新生成的 API Key
              </span>
              <div style={keyPreviewStyle}>{displayedKey}</div>
              <span style={{ fontSize: 13, color: "rgba(71, 85, 105, 0.85)" }}>
                该密钥只会显示一次，请立即复制并妥善保存。
              </span>
            </div>
            <div style={buttonRowStyle}>
              <button style={primaryButtonStyle} onClick={handleCopy}>
                复制密钥
              </button>
              <button
                style={buttonStyle}
                onClick={() => setDisplayedKey(null)}
              >
                已记录，隐藏密钥
              </button>
            </div>
            {copyMessage ? (
              <span
                style={{
                  fontSize: 13,
                  color:
                    copyState === "copied" ? "#16a34a" : "rgba(185, 28, 28, 0.85)",
                }}
              >
                {copyMessage}
              </span>
            ) : null}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {apiKeyRecord ? (
              <div
                style={{
                  display: "grid",
                  gap: 6,
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "1px dashed rgba(148, 163, 184, 0.32)",
                  backgroundColor: "rgba(226, 232, 240, 0.22)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  当前 API Key 已生成
                </span>
                {createdAtLabel ? (
                  <span style={{ fontSize: 13, color: "rgba(71, 85, 105, 0.85)" }}>
                    创建时间：{createdAtLabel}
                  </span>
                ) : null}
                <span style={{ fontSize: 13, color: "rgba(107, 114, 128, 0.88)" }}>
                  出于安全考虑，现有密钥无法再次查看。如需新的密钥，请重置。
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 6,
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "1px dashed rgba(37, 99, 235, 0.32)",
                  backgroundColor: "rgba(219, 234, 254, 0.32)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1d4ed8" }}>
                  尚未生成 API Key
                </span>
                <span style={{ fontSize: 13, color: "rgba(59, 130, 246, 0.85)" }}>
                  点击下方按钮生成新的安全密钥，用于配置管理的二次登录。
                </span>
              </div>
            )}

            <div style={buttonRowStyle}>
              <button
                style={primaryButtonStyle}
                onClick={handleGenerate}
                disabled={Boolean(displayedKey)}
              >
                {apiKeyRecord ? "重新生成 API Key" : "生成 API Key"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}