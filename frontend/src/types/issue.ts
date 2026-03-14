/** 指摘ステータス */
export type IssueStatus = "Open" | "InProgress" | "Done";

/** 指摘カテゴリ */
export type IssueType = "Quality" | "Safety" | "Construction" | "DesignChange";

/** 位置の種類 */
export type LocationType = "Element" | "Space";

/** 写真の種類 */
export type PhotoType = "Before" | "After";

/** 位置情報 */
export interface Location {
  type: LocationType;
  dbId?: number;
  worldPosition?: { x: number; y: number; z: number };
}

/** 写真 */
export interface Photo {
  id: string;
  blobKey: string;
  photoType: PhotoType;
  uploadedAt: string;
  url?: string;
}

/** 指摘 */
export interface Issue {
  id: string;
  title: string;
  description: string;
  issueType: IssueType;
  status: IssueStatus;
  location: Location;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}

/** 指摘作成リクエスト */
export interface CreateIssueCommand {
  title: string;
  description: string;
  issueType: IssueType;
  location: Location;
}

/** 指摘一覧クエリ結果 */
export interface IssueListQuery {
  items: Issue[];
  totalCount: number;
  page: number;
  pageSize: number;
}
