export type Space = {
  id: string;
  user_id?: string;
  name: string;
  description: string;
  color: string;
  created_at?: string;
};

export type Note = {
  id: string;
  user_id?: string;
  space_id: string;
  title: string;
  content: string;
  tags: string[];
  ai_summary?: string | null;
  ai_keywords?: string[];
  ai_topics?: string[];
  ai_related_ids?: string[];
  ai_suggested_actions?: string[];
  ai_urgency?: "now" | "soon" | "later" | "archive" | null;
  ai_analyzed_at?: string | null;
  pinned?: boolean;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Todo = {
  id: string;
  user_id?: string;
  space_id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "waiting" | "done";
  priority: "low" | "medium" | "high";
  due_date?: string | null;
  tags: string[];
  created_at?: string;
  updated_at?: string;
};

export type DocumentItem = {
  id: string;
  user_id?: string;
  space_id: string;
  title: string;
  content: string;
  tags: string[];
  source_path?: string | null;
  pinned?: boolean;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Attachment = {
  id: string;
  user_id?: string;
  space_id: string;
  entity_type: "space" | "note" | "document";
  entity_id: string | null;
  name: string;
  path: string;
  mime_type: string;
  size: number;
  url?: string;
  created_at?: string;
};

export type ViewKey = "dashboard" | "notes" | "todos" | "documents" | "settings";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type TodoViewMode = "board" | "list";

export type TodoFilter = "all" | "today" | "overdue" | "done";

export type WorkspaceData = {
  spaces: Space[];
  notes: Note[];
  documents: DocumentItem[];
  todos: Todo[];
  attachments: Attachment[];
};
