export const CONTRIBUTION_TYPES = [
  "Question",
  "Commentary",
  "Critique",
  "Localization note",
  "Clarification",
] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export interface Comment {
  uid: string;
  chapter: string;
  blockId: string;
  lang: string;
  contributionType: ContributionType;
  body: string;
  spanStart: number;
  spanEnd: number;
  spanExact: string;
  author: string;
  pending: boolean;
}
