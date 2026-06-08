export interface Comment {
  uid: string;
  chapter: string;
  blockId: string;
  lang: string;
  body: string;
  spanStart: number;
  spanEnd: number;
  spanExact: string;
  author: string;
  pending: boolean;
}
