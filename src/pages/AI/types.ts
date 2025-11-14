export type DatasetRecord = {
  id: string;
  name: string;
  description?: string | null;
  textColumn: string;
  createdAt?: string | null;
  originalFilename?: string | null;
};

