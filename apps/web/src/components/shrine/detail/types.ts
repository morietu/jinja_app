export type DetailReasonGroup = {
  title: string;
  items: string[];
};

export type DetailReasonSection = {
  kind: "reason";
  heading: string;
  groups: DetailReasonGroup[];
};

export type DetailProposalSection = {
  kind: "proposal";
  heading: string;
  lead: string;
  body?: string | null;
};

export type DetailMeaningItem = {
  key: string;
  title: string;
  body: string;
};

export type DetailMeaningSection = {
  kind: "meaning";
  heading: string;
  lead?: string;
  items: DetailMeaningItem[];
};

export type DetailSupplementGroup = {
  title: string;
  items: string[];
};

export type DetailSupplementSection = {
  kind: "supplement";
  heading: string;
  groups: DetailSupplementGroup[];
};

export type ShrineDetailSectionModel =
  | DetailReasonSection
  | DetailProposalSection
  | DetailMeaningSection
  | DetailSupplementSection;
