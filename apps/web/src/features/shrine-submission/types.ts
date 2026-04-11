export type ShrineSubmissionStatus = "pending" | "approved" | "rejected";

export type ShrineSubmissionTag = {
  id: number;
  name: string;
};

export type ShrineSubmissionPayload = {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  goriyaku_tags: string[];
  note: string;
};

export type ShrineSubmissionResponse = {
  id: number;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  goriyaku_tags: string[];
  note: string;
  status: ShrineSubmissionStatus;
  created_at: string;
};

export type ShrineSubmissionFieldErrors = Record<string, string>;

export type ShrineSubmissionFormValues = {
  name: string;
  address: string;
  note: string;
};
