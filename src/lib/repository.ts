import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attachment, DocumentItem, EntityType, Note, Space, Todo, WorkspaceData } from "./types";

const STORAGE_KEY = "personal-os-workspace-v2";
const BUCKET = "workspace-files";

type Entity = Space | Note | DocumentItem | Todo | Attachment;

const now = () => new Date().toISOString();

const isEntityType = (value: unknown): value is EntityType => value === "space" || value === "note" || value === "document";

export const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
};

const safePathName = (name: string) => name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "-");

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
  const entityType = patch?.entity_type ?? "space";
  const entityId = patch?.entity_id ?? spaceId;
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    space_id: spaceId,
    title: "新的待办事项",
    description: "",
    status: "todo",
    priority: "medium",
    tags: ["next"],
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
    entity_type: entityType,
    entity_id: entityId,
    due_date: toDateOnly(patch?.due_date),
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

function normalizeTodoRelation(todo: Todo, data: WorkspaceData): Pick<Todo, "space_id" | "entity_type" | "entity_id" | "due_date"> {
  const spaceId = data.spaces.some((space) => space.id === todo.space_id) ? todo.space_id : data.spaces[0]?.id;
  const entityType = isEntityType(todo.entity_type) ? todo.entity_type : "space";
  const requestedEntityId = todo.entity_id ?? (entityType === "space" ? spaceId : null);
  const entityExists =
    entityType === "space"
      ? data.spaces.some((space) => space.id === requestedEntityId)
      : entityType === "note"
        ? data.notes.some((note) => note.id === requestedEntityId && note.space_id === spaceId)
        : data.documents.some((document) => document.id === requestedEntityId && document.space_id === spaceId);

  if (!spaceId) {
    return { space_id: todo.space_id, entity_type: "space", entity_id: todo.space_id, due_date: toDateOnly(todo.due_date) };
  }

  return {
    space_id: spaceId,
    entity_type: entityExists ? entityType : "space",
    entity_id: entityExists ? requestedEntityId : spaceId,
    due_date: toDateOnly(todo.due_date),
  };
}

export function normalizeWorkspaceData(input: Partial<WorkspaceData>, userId?: string): WorkspaceData {
  const data: WorkspaceData = {
    spaces: Array.isArray(input.spaces) ? input.spaces : [],
    notes: Array.isArray(input.notes) ? input.notes : [],
    documents: Array.isArray(input.documents) ? input.documents : [],
    todos: Array.isArray(input.todos) ? input.todos : [],
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
  };

  const normalizedSpaces = data.spaces.map((space) => ({ ...space, user_id: userId ?? space.user_id }));
  const fallbackSpace = normalizedSpaces[0];
  const normalizedData = { ...data, spaces: normalizedSpaces };

  const notes = data.notes
    .filter((note) => normalizedSpaces.some((space) => space.id === note.space_id))
    .map((note) => ({ ...note, user_id: userId ?? note.user_id, tags: Array.isArray(note.tags) ? note.tags : [] }));
  const documents = data.documents
    .filter((document) => normalizedSpaces.some((space) => space.id === document.space_id))
    .map((document) => ({ ...document, user_id: userId ?? document.user_id, tags: Array.isArray(document.tags) ? document.tags : [] }));
  const todos = data.todos
    .filter((todo) => normalizedSpaces.some((space) => space.id === todo.space_id) || fallbackSpace)
    .map((todo) => {
      const withFallbackSpace = { ...todo, space_id: normalizedSpaces.some((space) => space.id === todo.space_id) ? todo.space_id : fallbackSpace?.id ?? todo.space_id };
      return {
        ...withFallbackSpace,
        ...normalizeTodoRelation(withFallbackSpace, { ...normalizedData, notes, documents }),
        user_id: userId ?? todo.user_id,
        tags: Array.isArray(todo.tags) ? todo.tags : [],
      };
    });
  const attachments = data.attachments
    .filter((attachment) => normalizedSpaces.some((space) => space.id === attachment.space_id) || fallbackSpace)
    .map((attachment) => {
      const spaceId = normalizedSpaces.some((space) => space.id === attachment.space_id) ? attachment.space_id : fallbackSpace?.id ?? attachment.space_id;
      const entityType = isEntityType(attachment.entity_type) ? attachment.entity_type : "space";
      return {
        ...attachment,
        user_id: userId ?? attachment.user_id,
        space_id: spaceId,
        entity_type: entityType,
        entity_id: attachment.entity_id ?? (entityType === "space" ? spaceId : null),
      };
    });

  return sortData({ spaces: normalizedSpaces, notes, documents, todos, attachments });
}

export function remapWorkspaceForUser(input: Partial<WorkspaceData>, userId: string): WorkspaceData {
  const source = normalizeWorkspaceData(input);
  const timestamp = Date.now();
  const spaceIds = new Map(source.spaces.map((space) => [space.id, crypto.randomUUID()]));
  const noteIds = new Map(source.notes.map((note) => [note.id, crypto.randomUUID()]));
  const documentIds = new Map(source.documents.map((document) => [document.id, crypto.randomUUID()]));
  const todoIds = new Map(source.todos.map((todo) => [todo.id, crypto.randomUUID()]));
  const attachmentIds = new Map(source.attachments.map((attachment) => [attachment.id, crypto.randomUUID()]));
  const mapEntityId = (type: EntityType, id: string | null) => {
    if (!id) return null;
    if (type === "space") return spaceIds.get(id) ?? null;
    if (type === "note") return noteIds.get(id) ?? null;
    return documentIds.get(id) ?? null;
  };

  const spaces = source.spaces.map((space) => ({ ...space, id: spaceIds.get(space.id)!, user_id: userId }));
  const notes = source.notes
    .filter((note) => spaceIds.has(note.space_id))
    .map((note) => ({
      ...note,
      id: noteIds.get(note.id)!,
      user_id: userId,
      space_id: spaceIds.get(note.space_id)!,
      ai_related_ids: (note.ai_related_ids ?? []).map((id) => noteIds.get(id)).filter(Boolean) as string[],
    }));
  const documents = source.documents
    .filter((document) => spaceIds.has(document.space_id))
    .map((document) => ({ ...document, id: documentIds.get(document.id)!, user_id: userId, space_id: spaceIds.get(document.space_id)! }));
  const todos = source.todos
    .filter((todo) => spaceIds.has(todo.space_id))
    .map((todo) => {
      const entityType = isEntityType(todo.entity_type) ? todo.entity_type : "space";
      const mappedSpaceId = spaceIds.get(todo.space_id)!;
      return {
        ...todo,
        id: todoIds.get(todo.id)!,
        user_id: userId,
        space_id: mappedSpaceId,
        entity_type: entityType,
        entity_id: mapEntityId(entityType, todo.entity_id) ?? mappedSpaceId,
        due_date: toDateOnly(todo.due_date),
      };
    });
  const attachments = source.attachments
    .filter((attachment) => spaceIds.has(attachment.space_id))
    .map((attachment, index) => {
      const id = attachmentIds.get(attachment.id)!;
      const entityType = isEntityType(attachment.entity_type) ? attachment.entity_type : "space";
      const mappedSpaceId = spaceIds.get(attachment.space_id)!;
      return {
        ...attachment,
        id,
        user_id: userId,
        space_id: mappedSpaceId,
        entity_type: entityType,
        entity_id: mapEntityId(entityType, attachment.entity_id) ?? (entityType === "space" ? mappedSpaceId : null),
        path: `${userId}/imports/${timestamp}-${index}-${safePathName(attachment.name)}`,
      };
    });

  return normalizeWorkspaceData({ spaces, notes, documents, todos, attachments }, userId);
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
  const migrated = normalizeWorkspaceData({ ...data, spaces, notes });
  const changedByShape = JSON.stringify(migrated) !== JSON.stringify(data);
  if (changed || changedByShape) writeLocal(migrated);
  return migrated;
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
  return normalizeWorkspaceData({
    spaces,
    notes: (notesRes.data ?? []) as Note[],
    documents: (documentsRes.data ?? []) as DocumentItem[],
    todos: (todosRes.data ?? []) as Todo[],
    attachments: (attachmentsRes.data ?? []) as Attachment[],
  }, userId);
}

export function exportLocalWorkspace() {
  return JSON.stringify(readLocal(), null, 2);
}

export function importLocalWorkspace(data: WorkspaceData) {
  writeLocal(normalizeWorkspaceData({ ...emptyWorkspace(), ...data }));
}

async function upsertLocal<T extends Entity>(key: keyof WorkspaceData, item: T): Promise<T> {
  const data = readLocal();
  const list = data[key] as T[];
  const exists = list.some((entry) => entry.id === item.id);
  const nextList = exists ? list.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...list];
  writeLocal(normalizeWorkspaceData({ ...data, [key]: nextList }));
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

async function patchLocalTodo(id: string, patch: Partial<Todo>): Promise<Todo> {
  const data = readLocal();
  const current = data.todos.find((todo) => todo.id === id);
  if (!current) throw new Error("Todo 不存在。");
  const nextTodo = { ...current, ...patch, due_date: toDateOnly(patch.due_date ?? current.due_date), updated_at: now() };
  writeLocal(normalizeWorkspaceData({ ...data, todos: data.todos.map((todo) => (todo.id === id ? nextTodo : todo)) }));
  return nextTodo;
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
    return upsertCloud(client, "todos", "todos", { ...todo, due_date: toDateOnly(todo.due_date), updated_at: now() });
  },
  async updateTodoStatus(client: SupabaseClient | null, id: string, status: Todo["status"]) {
    if (!client) return patchLocalTodo(id, { status });
    const { data, error } = await client.from("todos").update({ status, updated_at: now() }).eq("id", id).select("*").single();
    if (error) throw error;
    return data as Todo;
  },
  async patchTodo(client: SupabaseClient | null, id: string, patch: Partial<Todo>) {
    const normalizedPatch = { ...patch, due_date: patch.due_date === undefined ? undefined : toDateOnly(patch.due_date), updated_at: now() };
    Object.keys(normalizedPatch).forEach((key) => {
      if (normalizedPatch[key as keyof typeof normalizedPatch] === undefined) delete normalizedPatch[key as keyof typeof normalizedPatch];
    });
    if (!client) return patchLocalTodo(id, normalizedPatch);
    const { data, error } = await client.from("todos").update(normalizedPatch).eq("id", id).select("*").single();
    if (error) throw error;
    return data as Todo;
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
