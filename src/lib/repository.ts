import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attachment, DocumentItem, Note, Space, Todo, WorkspaceData } from "./types";

const STORAGE_KEY = "personal-os-workspace-v2";
const BUCKET = "workspace-files";

type Entity = Space | Note | DocumentItem | Todo | Attachment;

const now = () => new Date().toISOString();

export function createDefaultSpace(userId?: string): Space {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    name: "个人空间",
    description: "想法、文档、Todo 和附件的默认收集区。",
    color: "#0f766e",
    created_at: now(),
  };
}

export function createBlankNote(spaceId: string, userId?: string): Note {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    space_id: spaceId,
    title: "未命名想法",
    content: "",
    tags: [],
    pinned: false,
    archived: false,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function createBlankDocument(spaceId: string, userId?: string, patch?: Partial<DocumentItem>): DocumentItem {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    space_id: spaceId,
    title: "新 Markdown 文档",
    content: "# 新 Markdown 文档\n\n支持 GitHub Flavored Markdown。",
    tags: ["md"],
    source_path: null,
    pinned: false,
    archived: false,
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function createBlankTodo(spaceId: string, userId?: string, patch?: Partial<Todo>): Todo {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    space_id: spaceId,
    title: "新的待办事项",
    description: "",
    status: "todo",
    priority: "medium",
    due_date: null,
    tags: ["next"],
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function emptyWorkspace(): WorkspaceData {
  return {
    spaces: [],
    notes: [],
    documents: [],
    todos: [],
    attachments: [],
  };
}

function readLocal(): WorkspaceData {
  if (typeof window === "undefined") return emptyWorkspace();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyWorkspace();
  try {
    return migrateLocalWorkspace({ ...emptyWorkspace(), ...JSON.parse(raw) });
  } catch {
    return emptyWorkspace();
  }
}

function writeLocal(data: WorkspaceData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function migrateLocalWorkspace(data: WorkspaceData): WorkspaceData {
  let changed = false;
  const spaces = data.spaces.map((space) => {
    if (space.description !== "笔记、文档、Todo 和附件的默认收集区。") return space;
    changed = true;
    return { ...space, description: "想法、文档、Todo 和附件的默认收集区。" };
  });
  const notes = data.notes.map((note) => {
    if (note.title !== "未命名笔记" || note.content !== "# 未命名笔记\n\n从这里开始写。") return note;
    changed = true;
    return { ...note, title: "未命名想法", content: "", tags: note.tags.includes("draft") ? [] : note.tags };
  });
  const next = changed ? { ...data, spaces, notes } : data;
  if (changed) writeLocal(next);
  return next;
}

function sortData(data: WorkspaceData): WorkspaceData {
  return {
    spaces: [...data.spaces].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")),
    notes: [...data.notes].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")),
    documents: [...data.documents].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")),
    todos: [...data.todos].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")),
    attachments: [...data.attachments].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
  };
}

async function ensureCloudDefaultSpace(client: SupabaseClient, userId: string, spaces: Space[]) {
  if (spaces.length) return spaces;
  const defaultSpace = createDefaultSpace(userId);
  const { data, error } = await client.from("spaces").insert(defaultSpace).select("*").single();
  if (error) throw error;
  return [data as Space];
}

export async function listWorkspaceData(client: SupabaseClient | null, userId?: string): Promise<WorkspaceData> {
  if (!client || !userId) {
    const local = readLocal();
    if (local.spaces.length) return sortData(local);
    const defaultSpace = createDefaultSpace("local-user");
    const seeded = { ...emptyWorkspace(), spaces: [defaultSpace] };
    writeLocal(seeded);
    return seeded;
  }

  const [spacesRes, notesRes, documentsRes, todosRes, attachmentsRes] = await Promise.all([
    client.from("spaces").select("*").order("created_at", { ascending: true }),
    client.from("notes").select("*").order("updated_at", { ascending: false }),
    client.from("documents").select("*").order("updated_at", { ascending: false }),
    client.from("todos").select("*").order("created_at", { ascending: true }),
    client.from("attachments").select("*").order("created_at", { ascending: false }),
  ]);

  const error = spacesRes.error ?? notesRes.error ?? documentsRes.error ?? todosRes.error ?? attachmentsRes.error;
  if (error) throw error;

  const spaces = await ensureCloudDefaultSpace(client, userId, (spacesRes.data ?? []) as Space[]);
  return {
    spaces,
    notes: (notesRes.data ?? []) as Note[],
    documents: (documentsRes.data ?? []) as DocumentItem[],
    todos: (todosRes.data ?? []) as Todo[],
    attachments: (attachmentsRes.data ?? []) as Attachment[],
  };
}

export function exportLocalWorkspace() {
  return JSON.stringify(readLocal(), null, 2);
}

export function importLocalWorkspace(data: WorkspaceData) {
  writeLocal(sortData({ ...emptyWorkspace(), ...data }));
}

async function upsertLocal<T extends Entity>(key: keyof WorkspaceData, item: T): Promise<T> {
  const data = readLocal();
  const list = data[key] as T[];
  const exists = list.some((entry) => entry.id === item.id);
  const nextList = exists ? list.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...list];
  writeLocal({ ...data, [key]: nextList });
  return item;
}

async function deleteLocal(key: keyof WorkspaceData, id: string) {
  const data = readLocal();
  if (key === "spaces") {
    writeLocal({
      spaces: data.spaces.filter((space) => space.id !== id),
      notes: data.notes.filter((note) => note.space_id !== id),
      documents: data.documents.filter((document) => document.space_id !== id),
      todos: data.todos.filter((todo) => todo.space_id !== id),
      attachments: data.attachments.filter((attachment) => attachment.space_id !== id),
    });
    return;
  }
  const list = data[key] as Entity[];
  writeLocal({ ...data, [key]: list.filter((entry) => entry.id !== id) });
}

async function upsertCloud<T extends Entity>(client: SupabaseClient | null, table: string, key: keyof WorkspaceData, item: T) {
  if (!client) return upsertLocal(key, item);
  const { data, error } = await client.from(table).upsert(item).select("*").single();
  if (error) throw error;
  return data as T;
}

async function deleteCloud(client: SupabaseClient | null, table: string, key: keyof WorkspaceData, id: string) {
  if (!client) return deleteLocal(key, id);
  const { error } = await client.from(table).delete().eq("id", id);
  if (error) throw error;
}

export const repository = {
  async upsertSpace(client: SupabaseClient | null, space: Space) {
    return upsertCloud(client, "spaces", "spaces", space);
  },
  async deleteSpace(client: SupabaseClient | null, id: string) {
    return deleteCloud(client, "spaces", "spaces", id);
  },
  async upsertNote(client: SupabaseClient | null, note: Note) {
    return upsertCloud(client, "notes", "notes", { ...note, updated_at: now() });
  },
  async deleteNote(client: SupabaseClient | null, id: string) {
    return deleteCloud(client, "notes", "notes", id);
  },
  async upsertDocument(client: SupabaseClient | null, document: DocumentItem) {
    return upsertCloud(client, "documents", "documents", { ...document, updated_at: now() });
  },
  async deleteDocument(client: SupabaseClient | null, id: string) {
    return deleteCloud(client, "documents", "documents", id);
  },
  async upsertTodo(client: SupabaseClient | null, todo: Todo) {
    return upsertCloud(client, "todos", "todos", { ...todo, updated_at: now() });
  },
  async deleteTodo(client: SupabaseClient | null, id: string) {
    return deleteCloud(client, "todos", "todos", id);
  },
  async upsertAttachment(client: SupabaseClient | null, attachment: Attachment) {
    return upsertCloud(client, "attachments", "attachments", attachment);
  },
  async deleteAttachment(client: SupabaseClient | null, attachment: Attachment) {
    if (client) {
      await client.storage.from(BUCKET).remove([attachment.path]);
    }
    return deleteCloud(client, "attachments", "attachments", attachment.id);
  },
  async uploadFile(client: SupabaseClient | null, file: File, attachment: Attachment) {
    if (!client) {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("无法读取本地文件。"));
        reader.readAsDataURL(file);
      });
      return { ...attachment, url };
    }
    const { error } = await client.storage.from(BUCKET).upload(attachment.path, file, { upsert: true });
    if (error) throw error;
    const { data } = client.storage.from(BUCKET).getPublicUrl(attachment.path);
    return { ...attachment, url: data.publicUrl };
  },
};
