const STORAGE_KEY = "aegisdb:secondary-api-key";

export type StoredApiKey = {
  key: string;
  createdAt: string;
  viewed: boolean;
};

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("aegisdb:api-key-changed"));
}

function persist(record: StoredApiKey) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  notifyChange();
}

function generateRandomKey(length = 48) {
  let result = "";
  const alphabetLength = ALPHABET.length;

  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i += 1) {
      result += ALPHABET[randomValues[i] % alphabetLength];
    }
    return result;
  }

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * alphabetLength);
    result += ALPHABET[index];
  }
  return result;
}

export function loadApiKey(): StoredApiKey | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredApiKey;
    if (!parsed?.key || typeof parsed.key !== "string") {
      window.localStorage.removeItem(STORAGE_KEY);
      notifyChange();
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    notifyChange();
    return null;
  }
}

export function createAndStoreApiKey(): StoredApiKey {
  const record: StoredApiKey = {
    key: generateRandomKey(),
    createdAt: new Date().toISOString(),
    viewed: false,
  };
  persist(record);
  return record;
}

export function markApiKeyViewed(): StoredApiKey | null {
  const current = loadApiKey();
  if (!current) return null;
  if (current.viewed) return current;
  const updated: StoredApiKey = { ...current, viewed: true };
  persist(updated);
  return updated;
}

export function clearApiKey() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  notifyChange();
}

export function verifyApiKey(candidate: string): boolean {
  const record = loadApiKey();
  if (!record) return false;
  const stored = record.key;
  const value = candidate.trim();
  let mismatch = stored.length ^ value.length;
  const maxLength = Math.max(stored.length, value.length);
  for (let i = 0; i < maxLength; i += 1) {
    const storedCode = i < stored.length ? stored.charCodeAt(i) : 0;
    const candidateCode = i < value.length ? value.charCodeAt(i) : 0;
    mismatch |= storedCode ^ candidateCode;
  }
  return mismatch === 0;
}

export function getApiKeyVersion(): string | null {
  const record = loadApiKey();
  return record?.createdAt ?? null;
}


