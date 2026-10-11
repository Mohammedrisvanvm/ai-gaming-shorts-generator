export type Game = "EA SPORTS FC";

export type ProjectStatus =
  | "created"
  | "acquiring_source"
  | "analyzing"
  | "ranking_highlights"
  | "rendering_previews"
  | "awaiting_review"
  | "rendering_final"
  | "completed"
  | "failed";

export interface ProjectSummary {
  id: string;
  sourceUrl: string;
  game: Game;
  status: ProjectStatus;
  createdAt: string;
}
