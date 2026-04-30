"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  createBlankDocument,
  createBlankNote,
  createBlankTodo,
  createDefaultSpace,
  emptyWorkspace,
  importLocalWorkspace,
  listWorkspaceData,
  normalizeWorkspaceData,
  repository,
  remapWorkspaceForUser,
  toDateOnly,
} from "@/lib/repository";
import type { Attachment, DocumentItem, Note, SaveState, Space, Todo, TodoFilter, TodoViewMode, ViewKey, WorkspaceData } from "@/lib/types";
import { ConfirmDialog, LoadingState, ToastStack } from "@/components/ui";
import type { ToastMessage } from "@/components/ui";
import { CommandPalette, ContextPanel, DashboardView, IdeasView, KnowledgeBaseView, LoginView, SettingsView, Sidebar, TodosView, TopBar } from "@/components/workbench/views";

const spaceColors = ["#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c", "#475569"];

const localDateOnly = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const plainText = (content: string) =>
  content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extractTags = (value: string) =>
  Array.from(value.matchAll(/(^|\s)#([\p{L}\p{N}_/-]+)/gu))
    .map((match) => match[2])
    .filter(Boolean);

const uniq = (values: string[], limit = 20) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);

type TagStat = { tag: string; count: number };

type SpaceStats = {
  notes: number;
  documents: number;
  todos: number;
  openTodos: number;
  attachments: number;
};

const emptySpaceStats: SpaceStats = { notes: 0, documents: 0, todos: 0, openTodos: 0, attachments: 0 };

const tagStatsFrom = (items: Array<{ tags: string[] }>, limit = 14): TagStat[] => {
  const counts = new Map<string, number>();
  items.forEach((item) => item.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
};

const titleFromContent = (content: string, fallback: string) => {
  const title = plainText(content)
    .replace(/[#*_`>~\-[\]()]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!title) return fallback;
  return title.length > 32 ? `${title.slice(0, 32)}...` : title;
};

const downloadTextFile = (filename: string, content: string, type = "text/plain;charset=utf-8") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("无法读取文件"));
    reader.readAsText(file);
  });

const safePathName = (name: string) => name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "-");

export default function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace());
  const [view, setView] = useState<ViewKey>("dashboard");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("personal-os-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [todoViewMode, setTodoViewMode] = useState<TodoViewMode>("board");
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [analyzingIdeaIds, setAnalyzingIdeaIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; confirmLabel?: string; onConfirm: () => void }>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const client = session && supabase ? supabase : null;
  const cloudMode = Boolean(client);
  const userId = session?.user.id ?? (isSupabaseConfigured ? undefined : "local-user");

  const activeSpace = workspace.spaces.find((space) => space.id === activeSpaceId) ?? workspace.spaces[0] ?? null;
  const activeNote = workspace.notes.find((note) => note.id === activeNoteId) ?? null;
  const activeDocument = workspace.documents.find((document) => document.id === activeDocumentId) ?? null;
  const anySaving = Object.values(saveStates).some((state) => state === "pending" || state === "saving");
  const saveStateFor = useCallback((key: string): SaveState => saveStates[key] ?? "idle", [saveStates]);

  const switchView = (nextView: ViewKey) => {
    setView(nextView);
    setSidebarOpen(false);
    setContextOpen(false);
    setCommandOpen(false);
  };

  const openNote = (noteId: string) => {
    const note = workspace.notes.find((item) => item.id === noteId);
    if (note) setActiveSpaceId(note.space_id);
    setActiveNoteId(noteId);
    switchView("notes");
  };

  const openDocument = (documentId: string) => {
    const document = workspace.documents.find((item) => item.id === documentId);
    if (document) setActiveSpaceId(document.space_id);
    setActiveDocumentId(documentId);
    switchView("documents");
  };

  const openTodo = (todoId: string) => {
    const todo = workspace.todos.find((item) => item.id === todoId);
    if (todo) setActiveSpaceId(todo.space_id);
    setTodoFilter("all");
    switchView("todos");
  };

  const toast = useCallback((tone: ToastMessage["tone"], title: string, detail?: string) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, tone, title, detail }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600);
  }, []);

  const loadData = useCallback(
    async (nextSession?: Session | null) => {
      try {
        setLoading(true);
        const nextUserId = nextSession?.user.id ?? (isSupabaseConfigured ? undefined : "local-user");
        const data = await listWorkspaceData(nextSession && supabase ? supabase : null, nextUserId);
        setWorkspace(data);
        setActiveSpaceId((current) => (current && data.spaces.some((space) => space.id === current) ? current : data.spaces[0]?.id ?? null));
        setActiveNoteId((current) => (current && data.notes.some((note) => note.id === current) ? current : data.notes[0]?.id ?? null));
        setActiveDocumentId((current) => (current && data.documents.some((document) => document.id === current) ? current : data.documents[0]?.id ?? null));
      } catch (error) {
        toast("error", "加载失败", error instanceof Error ? error.message : "请稍后重试");
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => loadData(null));
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadData(data.session);
      else setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) loadData(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, [loadData]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("personal-os-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setSidebarOpen(false);
        setContextOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!anySaving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anySaving]);

  useEffect(() => () => {
    saveTimers.current.forEach((timer) => clearTimeout(timer));
    saveTimers.current.clear();
  }, []);

  const scopedData = useMemo(() => {
    const inScope = <T extends { space_id: string; tags?: string[]; title?: string; content?: string; description?: string }>(items: T[]) => {
      const search = query.trim().toLowerCase();
      return items.filter((item) => {
        const spaceMatch = globalSearch || !activeSpace?.id || item.space_id === activeSpace.id;
        const tagMatch = !selectedTag || item.tags?.includes(selectedTag);
        const searchText = `${item.title ?? ""} ${item.content ?? ""} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
        const searchMatch = !search || searchText.includes(search);
        return spaceMatch && tagMatch && searchMatch;
      });
    };

    const notes = inScope(workspace.notes).filter((note) => !note.archived);
    const documents = inScope(workspace.documents).filter((document) => !document.archived);
    const todos = inScope(workspace.todos);
    const attachments = workspace.attachments.filter((attachment) => globalSearch || !activeSpace?.id || attachment.space_id === activeSpace.id);
    return { notes, documents, todos, attachments };
  }, [activeSpace, globalSearch, query, selectedTag, workspace]);

  const filteredTodos = useMemo(() => {
    const today = localDateOnly();
    return scopedData.todos.filter((todo) => {
      const dueDate = toDateOnly(todo.due_date);
      if (todoFilter === "done") return todo.status === "done";
      if (todoFilter === "today") return dueDate === today;
      if (todoFilter === "overdue") return Boolean(dueDate && dueDate < today && todo.status !== "done");
      return true;
    });
  }, [scopedData.todos, todoFilter]);

  const scopedTagStats = useMemo(() => tagStatsFrom([...scopedData.notes, ...scopedData.documents, ...scopedData.todos], 32), [scopedData.documents, scopedData.notes, scopedData.todos]);

  const contextSpaceId = activeSpace?.id;
  const contextTodos = useMemo(() => {
    if (view === "notes") return activeNoteId ? scopedData.todos.filter((todo) => todo.entity_type === "note" && todo.entity_id === activeNoteId) : [];
    if (view === "documents") return activeDocumentId ? scopedData.todos.filter((todo) => todo.entity_type === "document" && todo.entity_id === activeDocumentId) : [];
    if (contextSpaceId) return scopedData.todos.filter((todo) => todo.space_id === contextSpaceId);
    return scopedData.todos;
  }, [activeDocumentId, activeNoteId, contextSpaceId, scopedData.todos, view]);

  const contextAttachments = useMemo(() => {
    if (view === "notes" && activeNoteId) return scopedData.attachments.filter((attachment) => attachment.entity_type === "note" && attachment.entity_id === activeNoteId);
    if (view === "documents" && activeDocumentId) return scopedData.attachments.filter((attachment) => attachment.entity_type === "document" && attachment.entity_id === activeDocumentId);
    if (activeSpace?.id) return scopedData.attachments.filter((attachment) => attachment.space_id === activeSpace.id);
    return scopedData.attachments;
  }, [activeDocumentId, activeNoteId, activeSpace, scopedData.attachments, view]);

  const spaceStats = useMemo(() => {
    const stats = Object.fromEntries(workspace.spaces.map((space) => [space.id, { ...emptySpaceStats }])) as Record<string, SpaceStats>;
    workspace.notes.forEach((note) => {
      stats[note.space_id] ??= { ...emptySpaceStats };
      if (!note.archived) stats[note.space_id].notes += 1;
    });
    workspace.documents.forEach((document) => {
      stats[document.space_id] ??= { ...emptySpaceStats };
      if (!document.archived) stats[document.space_id].documents += 1;
    });
    workspace.todos.forEach((todo) => {
      stats[todo.space_id] ??= { ...emptySpaceStats };
      stats[todo.space_id].todos += 1;
      if (todo.status !== "done") stats[todo.space_id].openTodos += 1;
    });
    workspace.attachments.forEach((attachment) => {
      stats[attachment.space_id] ??= { ...emptySpaceStats };
      stats[attachment.space_id].attachments += 1;
    });
    return stats;
  }, [workspace.attachments, workspace.documents, workspace.notes, workspace.spaces, workspace.todos]);

  const runOptimistic = async (nextData: WorkspaceData, action: () => Promise<unknown>, success: string) => {
    const previous = workspace;
    setWorkspace(nextData);
    try {
      await action();
      toast("success", success);
    } catch (error) {
      setWorkspace(previous);
      toast("error", "操作失败", error instanceof Error ? error.message : "请稍后重试");
    }
  };

  const scheduleSave = <T,>(key: string, item: T, save: (item: T) => Promise<unknown>) => {
    setSaveStates((current) => ({ ...current, [key]: "pending" }));
    const existingTimer = saveTimers.current.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(async () => {
      setSaveStates((current) => ({ ...current, [key]: "saving" }));
      try {
        await save(item);
        setSaveStates((current) => ({ ...current, [key]: "saved" }));
        window.setTimeout(() => {
          setSaveStates((current) => (current[key] === "saved" ? { ...current, [key]: "idle" } : current));
        }, 1200);
      } catch (error) {
        setSaveStates((current) => ({ ...current, [key]: "error" }));
        toast("error", "保存失败", error instanceof Error ? error.message : "请稍后重试");
      } finally {
        saveTimers.current.delete(key);
      }
    }, 450);
    saveTimers.current.set(key, timer);
  };

  const selectSpace = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    setActiveNoteId(workspace.notes.find((note) => note.space_id === spaceId)?.id ?? null);
    setActiveDocumentId(workspace.documents.find((document) => document.space_id === spaceId)?.id ?? null);
    setSelectedTag(null);
    setSidebarOpen(false);
  };

  const updateSpace = (space: Space) => {
    const next = { ...workspace, spaces: workspace.spaces.map((item) => (item.id === space.id ? space : item)) };
    const previous = workspace;
    setWorkspace(next);
    repository.upsertSpace(client, space).catch((error) => {
      setWorkspace(previous);
      toast("error", "保存空间失败", error instanceof Error ? error.message : "请稍后重试");
    });
  };

  const createSpace = async () => {
    const space = {
      ...createDefaultSpace(userId),
      name: `新知识库 ${workspace.spaces.length + 1}`,
      color: spaceColors[workspace.spaces.length % spaceColors.length],
    };
    setActiveSpaceId(space.id);
    await runOptimistic({ ...workspace, spaces: [...workspace.spaces, space] }, () => repository.upsertSpace(client, space), "已创建知识库");
  };

  const deleteSpace = (space: Space) => {
    setConfirm({
      title: "删除知识库",
      description: `将删除「${space.name}」和它关联的想法、文档、Todo 与附件。此操作不可撤销。`,
      confirmLabel: "删除",
      onConfirm: () => {
        const next = {
          spaces: workspace.spaces.filter((item) => item.id !== space.id),
          notes: workspace.notes.filter((item) => item.space_id !== space.id),
          documents: workspace.documents.filter((item) => item.space_id !== space.id),
          todos: workspace.todos.filter((item) => item.space_id !== space.id),
          attachments: workspace.attachments.filter((item) => item.space_id !== space.id),
        };
        setActiveSpaceId(next.spaces[0]?.id ?? null);
        setConfirm(null);
        runOptimistic(next, () => repository.deleteSpace(client, space.id), "已删除知识库");
      },
    });
  };

  const createNote = async (content = "", targetSpaceId = activeSpace?.id) => {
    if (!targetSpaceId) return;
    const note = {
      ...createBlankNote(targetSpaceId, userId),
      title: titleFromContent(content, "未命名想法"),
      content,
      tags: extractTags(content),
    };
    setActiveNoteId(note.id);
    setActiveSpaceId(targetSpaceId);
    switchView("notes");
    await runOptimistic({ ...workspace, notes: [note, ...workspace.notes] }, () => repository.upsertNote(client, note), "已创建想法");
  };

  const saveNotePatch = (noteId: string, patch: Partial<Note>) => {
    const currentNote = workspace.notes.find((note) => note.id === noteId);
    if (!currentNote) return;
    const content = patch.content ?? currentNote.content;
    const tags = patch.tags ?? uniq([...currentNote.tags, ...extractTags(content)], 16);
    const note = { ...currentNote, ...patch, tags, updated_at: new Date().toISOString() };
    setWorkspace((current) => ({ ...current, notes: current.notes.map((item) => (item.id === note.id ? note : item)) }));
    scheduleSave(`note:${note.id}`, note, (item) => repository.upsertNote(client, item));
  };

  const deleteNote = (note: Note) => {
    setConfirm({
      title: "删除想法",
      description: `确定删除「${note.title}」吗？此操作不可撤销。`,
      confirmLabel: "删除",
      onConfirm: () => {
        const nextNotes = workspace.notes.filter((item) => item.id !== note.id);
        const nextTodos = workspace.todos.map((todo) => (todo.entity_type === "note" && todo.entity_id === note.id ? { ...todo, entity_type: "space" as const, entity_id: todo.space_id } : todo));
        setActiveNoteId(nextNotes[0]?.id ?? null);
        setConfirm(null);
        runOptimistic({ ...workspace, notes: nextNotes, todos: nextTodos }, async () => {
          await Promise.all(nextTodos.filter((todo, index) => todo !== workspace.todos[index]).map((todo) => repository.upsertTodo(client, todo)));
          await repository.deleteNote(client, note.id);
        }, "已删除想法");
      },
    });
  };

  const analyzeIdea = async (note: Note) => {
    if (!note.content.trim()) {
      toast("info", "没有可分析的内容");
      return;
    }
    setAnalyzingIdeaIds((current) => uniq([...current, note.id], 20));
    try {
      const response = await fetch("/api/ai/ideas/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: { id: note.id, title: note.title, content: note.content, tags: note.tags },
          ideas: workspace.notes.filter((item) => item.id !== note.id).slice(0, 30),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || data?.error || "AI 分析失败");
      const keywords = uniq((data.keywords ?? []).map(String), 8);
      saveNotePatch(note.id, {
        tags: uniq([...note.tags, ...keywords], 16),
        ai_summary: String(data.summary ?? "").trim(),
        ai_keywords: keywords,
        ai_topics: uniq((data.topics ?? []).map(String), 4),
        ai_related_ids: uniq((data.related_ids ?? []).map(String), 5),
        ai_suggested_actions: uniq((data.suggested_actions ?? []).map(String), 5),
        ai_urgency: data.urgency ?? "later",
        ai_analyzed_at: data.analyzed_at ?? new Date().toISOString(),
      });
      toast("success", "AI 分析完成");
    } catch (error) {
      toast("error", "AI 分析失败", error instanceof Error ? error.message : "请稍后重试");
    } finally {
      setAnalyzingIdeaIds((current) => current.filter((id) => id !== note.id));
    }
  };

  const createDocument = async (patch?: Partial<DocumentItem>) => {
    if (!activeSpace?.id) return;
    const document = createBlankDocument(activeSpace.id, userId, patch);
    setActiveDocumentId(document.id);
    setActiveSpaceId(activeSpace.id);
    switchView("documents");
    await runOptimistic({ ...workspace, documents: [document, ...workspace.documents] }, () => repository.upsertDocument(client, document), "已创建文档");
  };

  const saveDocumentPatch = (patch: Partial<DocumentItem>) => {
    if (!activeDocument) return;
    const content = patch.content ?? activeDocument.content;
    const tags = patch.tags ?? uniq([...activeDocument.tags, ...extractTags(content)], 16);
    const document = { ...activeDocument, ...patch, tags, updated_at: new Date().toISOString() };
    setWorkspace((current) => ({ ...current, documents: current.documents.map((item) => (item.id === document.id ? document : item)) }));
    scheduleSave(`document:${document.id}`, document, (item) => repository.upsertDocument(client, item));
  };

  const deleteDocument = (document: DocumentItem) => {
    setConfirm({
      title: "删除文档",
      description: `确定删除「${document.title}」吗？此操作不可撤销。`,
      confirmLabel: "删除",
      onConfirm: () => {
        const nextDocuments = workspace.documents.filter((item) => item.id !== document.id);
        const nextTodos = workspace.todos.map((todo) => (todo.entity_type === "document" && todo.entity_id === document.id ? { ...todo, entity_type: "space" as const, entity_id: todo.space_id } : todo));
        setActiveDocumentId(nextDocuments[0]?.id ?? null);
        setConfirm(null);
        runOptimistic({ ...workspace, documents: nextDocuments, todos: nextTodos }, async () => {
          await Promise.all(nextTodos.filter((todo, index) => todo !== workspace.todos[index]).map((todo) => repository.upsertTodo(client, todo)));
          await repository.deleteDocument(client, document.id);
        }, "已删除文档");
      },
    });
  };

  const createTodo = async (patch?: Partial<Todo>) => {
    if (!activeSpace?.id) return;
    const parent =
      view === "notes" && activeNote
        ? { entity_type: "note" as const, entity_id: activeNote.id, space_id: activeNote.space_id }
        : view === "documents" && activeDocument
          ? { entity_type: "document" as const, entity_id: activeDocument.id, space_id: activeDocument.space_id }
          : { entity_type: "space" as const, entity_id: activeSpace.id, space_id: activeSpace.id };
    const todo = createBlankTodo(parent.space_id, userId, { ...parent, ...patch, due_date: toDateOnly(patch?.due_date) });
    setActiveSpaceId(activeSpace.id);
    setTodoFilter("all");
    switchView("todos");
    await runOptimistic({ ...workspace, todos: [todo, ...workspace.todos] }, () => repository.upsertTodo(client, todo), "已创建 Todo");
  };

  const saveTodo = (todo: Todo) => {
    const nextTodo = { ...todo, due_date: toDateOnly(todo.due_date), updated_at: new Date().toISOString() };
    setWorkspace((current) => ({ ...current, todos: current.todos.map((item) => (item.id === todo.id ? nextTodo : item)) }));
    scheduleSave(`todo:${todo.id}`, nextTodo, (item) => repository.upsertTodo(client, item));
  };

  const updateTodoStatus = (todoId: string, status: Todo["status"]) => {
    const previous = workspace;
    const currentTodo = workspace.todos.find((todo) => todo.id === todoId);
    if (!currentTodo || currentTodo.status === status) return;
    const nextTodo = { ...currentTodo, status, updated_at: new Date().toISOString() };
    setWorkspace((current) => ({ ...current, todos: current.todos.map((todo) => (todo.id === todoId ? nextTodo : todo)) }));
    repository.updateTodoStatus(client, todoId, status).catch((error) => {
      setWorkspace(previous);
      toast("error", "保存 Todo 失败", error instanceof Error ? error.message : "请稍后重试");
    });
  };

  const advanceTodo = (todo: Todo) => {
    const nextStatus: Todo["status"] = todo.status === "todo" ? "doing" : todo.status === "doing" || todo.status === "waiting" ? "done" : "todo";
    updateTodoStatus(todo.id, nextStatus);
  };

  const deleteTodo = (todo: Todo) => runOptimistic({ ...workspace, todos: workspace.todos.filter((item) => item.id !== todo.id) }, () => repository.deleteTodo(client, todo.id), "已删除 Todo");

  const clearCompletedTodos = () => {
    const completed = scopedData.todos.filter((todo) => todo.status === "done");
    if (!completed.length) {
      toast("info", "没有已完成的 Todo");
      return;
    }
    setConfirm({
      title: "清理已完成 Todo",
      description: `将删除 ${completed.length} 个已完成 Todo。此操作不可撤销。`,
      confirmLabel: "清理",
      onConfirm: async () => {
        setConfirm(null);
        const next = { ...workspace, todos: workspace.todos.filter((todo) => !completed.some((item) => item.id === todo.id)) };
        const previous = workspace;
        setWorkspace(next);
        try {
          await Promise.all(completed.map((todo) => repository.deleteTodo(client, todo.id)));
          toast("success", "已清理 Todo");
        } catch (error) {
          setWorkspace(previous);
          toast("error", "清理失败", error instanceof Error ? error.message : "请稍后重试");
        }
      },
    });
  };

  const currentEntity = (): Pick<Attachment, "entity_type" | "entity_id"> => {
    if (view === "notes" && activeNoteId) return { entity_type: "note", entity_id: activeNoteId };
    if (view === "documents" && activeDocumentId) return { entity_type: "document", entity_id: activeDocumentId };
    return { entity_type: "space", entity_id: activeSpace?.id ?? null };
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !activeSpace?.id) return;
    const fileArray = Array.from(files);
    setUploadingNames((current) => [...current, ...fileArray.map((file) => file.name)]);
    try {
      const uploaded: Attachment[] = [];
      for (const file of fileArray) {
        const attachment: Attachment = {
          id: crypto.randomUUID(),
          user_id: userId,
          space_id: activeSpace.id,
          ...currentEntity(),
          name: file.name,
          path: `${userId ?? "local-user"}/${Date.now()}-${safePathName(file.name)}`,
          mime_type: file.type || "application/octet-stream",
          size: file.size,
          created_at: new Date().toISOString(),
        };
        const withUrl = await repository.uploadFile(client, file, attachment);
        await repository.upsertAttachment(client, withUrl);
        uploaded.push(withUrl);
      }
      setWorkspace((current) => ({ ...current, attachments: [...uploaded, ...current.attachments] }));
      toast("success", `已上传 ${uploaded.length} 个附件`);
    } catch (error) {
      toast("error", "上传失败", error instanceof Error ? error.message : "请稍后重试");
    } finally {
      setUploadingNames((current) => current.filter((name) => !fileArray.some((file) => file.name === name)));
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const deleteAttachment = (attachment: Attachment) => {
    setConfirm({
      title: "删除附件",
      description: `确定删除「${attachment.name}」吗？`,
      confirmLabel: "删除",
      onConfirm: () => {
        setConfirm(null);
        runOptimistic({ ...workspace, attachments: workspace.attachments.filter((item) => item.id !== attachment.id) }, () => repository.deleteAttachment(client, attachment), "已删除附件");
      },
    });
  };

  const insertImage = (attachment: Attachment) => {
    if (!attachment.mime_type.startsWith("image/") || !attachment.url) return;
    const markdown = `\n\n![${attachment.name}](${attachment.url})\n`;
    if (view === "documents" && activeDocument) saveDocumentPatch({ content: `${activeDocument.content}${markdown}` });
    if (view === "notes" && activeNote) saveNotePatch(activeNote.id, { content: `${activeNote.content}${markdown}` });
  };

  const importMarkdown = async (file: File | null) => {
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      await createDocument({ title: file.name.replace(/\.md$/i, ""), content, tags: uniq(["md", ...extractTags(content)], 12), source_path: file.name });
    } catch (error) {
      toast("error", "导入 Markdown 失败", error instanceof Error ? error.message : "请稍后重试");
    } finally {
      if (markdownInputRef.current) markdownInputRef.current.value = "";
    }
  };

  const exportJson = () => downloadTextFile("personal-os-workspace.json", JSON.stringify(workspace, null, 2), "application/json;charset=utf-8");

  const importJson = async (file: File | null) => {
    if (!file) return;
    try {
      const rawData = { ...emptyWorkspace(), ...JSON.parse(await readFileAsText(file)) } as WorkspaceData;
      const data = client && userId ? remapWorkspaceForUser(rawData, userId) : normalizeWorkspaceData(rawData, userId);
      if (client) {
        await Promise.all([
          ...data.spaces.map((space) => repository.upsertSpace(client, space)),
          ...data.notes.map((note) => repository.upsertNote(client, note)),
          ...data.documents.map((document) => repository.upsertDocument(client, document)),
          ...data.todos.map((todo) => repository.upsertTodo(client, todo)),
          ...data.attachments.map((attachment) => repository.upsertAttachment(client, attachment)),
        ]);
      } else {
        importLocalWorkspace(data);
      }
      setWorkspace(data);
      setActiveSpaceId(data.spaces[0]?.id ?? null);
      setActiveNoteId(data.notes[0]?.id ?? null);
      setActiveDocumentId(data.documents[0]?.id ?? null);
      toast("success", "已导入工作区");
    } catch (error) {
      toast("error", "导入 JSON 失败", error instanceof Error ? error.message : "请检查文件格式");
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = "";
    }
  };

  const signIn = async () => {
    if (!supabase || !authEmail.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail.trim(), options: { emailRedirectTo: window.location.origin } });
    setAuthMessage(error ? error.message : "登录链接已发送，请检查邮箱。");
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setWorkspace(emptyWorkspace());
  };

  const renderView = () => {
    if (view === "dashboard") {
      return (
        <DashboardView
          notes={scopedData.notes}
          documents={scopedData.documents}
          todos={scopedData.todos}
          attachments={scopedData.attachments}
          activeSpace={activeSpace}
          query={query}
          globalSearch={globalSearch}
          onQueryChange={setQuery}
          onGlobalSearchChange={setGlobalSearch}
          onOpenCommand={() => setCommandOpen(true)}
          onNewIdea={() => createNote()}
          onNewTodo={() => createTodo()}
          onNewDocument={() => createDocument()}
          onSelectNote={openNote}
          onSelectDocument={openDocument}
          onUpload={() => uploadInputRef.current?.click()}
        />
      );
    }
    if (view === "notes") {
      return (
        <IdeasView
          ideas={scopedData.notes}
          activeIdea={activeNote}
          saveState={activeNote ? saveStateFor(`note:${activeNote.id}`) : "idle"}
          analyzingIdeaIds={analyzingIdeaIds}
          onSelect={openNote}
          onNew={(content) => createNote(content)}
          onPatch={saveNotePatch}
          onDelete={deleteNote}
          onAnalyze={analyzeIdea}
        />
      );
    }
    if (view === "documents") {
      return (
        <KnowledgeBaseView
          documents={scopedData.documents}
          activeDocument={activeDocument}
          saveState={activeDocument ? saveStateFor(`document:${activeDocument.id}`) : "idle"}
          onSelect={openDocument}
          onPatch={saveDocumentPatch}
          onNew={() => createDocument()}
          onDelete={deleteDocument}
          onImport={() => markdownInputRef.current?.click()}
          onExport={(document) => downloadTextFile(`${document.title || "document"}.md`, document.content, "text/markdown;charset=utf-8")}
          onTogglePinned={(document) => saveDocumentPatch({ pinned: !document.pinned })}
          onArchive={(document) => saveDocumentPatch({ archived: !document.archived })}
        />
      );
    }
    if (view === "todos") {
      return (
        <TodosView
          todos={filteredTodos}
          mode={todoViewMode}
          filter={todoFilter}
          onModeChange={setTodoViewMode}
          onFilterChange={setTodoFilter}
          onSave={saveTodo}
          onAdvance={advanceTodo}
          onDropStatus={updateTodoStatus}
          onDelete={deleteTodo}
          onClearDone={clearCompletedTodos}
          onNew={(patch) => createTodo(patch)}
        />
      );
    }
    return <SettingsView cloudMode={cloudMode} session={session} onExportJson={exportJson} onImportJson={() => jsonInputRef.current?.click()} onSignOut={signOut} />;
  };

  if (loading) return <LoadingState label="正在加载工作区..." />;

  if (isSupabaseConfigured && !session) {
    return <LoginView authEmail={authEmail} authMessage={authMessage} onEmailChange={setAuthEmail} onSignIn={signIn} />;
  }

  return (
    <main className="app-frame min-h-dvh text-[var(--app-fg)]">
      <div className="grid min-h-dvh lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Sidebar
          open={sidebarOpen}
          spaces={workspace.spaces}
          spaceStats={spaceStats}
          activeSpace={activeSpace}
          view={view}
          theme={theme}
          onClose={() => setSidebarOpen(false)}
          onThemeChange={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          onViewChange={switchView}
          onSelectSpace={selectSpace}
          onUpdateSpace={updateSpace}
          onCreateSpace={createSpace}
          onDeleteSpace={deleteSpace}
        />

        <section className="min-w-0 border-x border-[var(--border)]">
          <TopBar
            activeSpace={activeSpace}
            view={view}
            query={query}
            onMenu={() => setSidebarOpen(true)}
            onSearch={setQuery}
            onCommand={() => setCommandOpen(true)}
            onContext={() => setContextOpen(true)}
            onNew={() => (view === "todos" ? createTodo() : view === "documents" ? createDocument() : view === "notes" ? createNote() : setCommandOpen(true))}
          />
          <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">{renderView()}</div>
        </section>

        <ContextPanel
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          tagStats={scopedTagStats}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          attachments={contextAttachments}
          activeSpace={activeSpace}
          activeNote={activeNote}
          activeDocument={activeDocument}
          todos={contextTodos}
          view={view}
          uploadingNames={uploadingNames}
          onUpload={() => uploadInputRef.current?.click()}
          onDeleteAttachment={deleteAttachment}
          onInsertImage={insertImage}
        />
      </div>

      <input ref={uploadInputRef} className="hidden" type="file" multiple onChange={(event) => handleUpload(event.target.files)} />
      <input ref={markdownInputRef} className="hidden" type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={(event) => importMarkdown(event.target.files?.[0] ?? null)} />
      <input ref={jsonInputRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => importJson(event.target.files?.[0] ?? null)} />

      {commandOpen ? (
        <CommandPalette
          query={query}
          spaces={workspace.spaces}
          notes={workspace.notes}
          documents={workspace.documents}
          todos={workspace.todos}
          onClose={() => setCommandOpen(false)}
          onSearch={setQuery}
          onView={switchView}
          onSpace={(spaceId) => {
            selectSpace(spaceId);
            setCommandOpen(false);
          }}
          onNote={openNote}
          onDocument={openDocument}
          onTodo={openTodo}
          onCreateIdea={() => {
            createNote();
            setCommandOpen(false);
          }}
          onCreateTodo={() => {
            createTodo();
            setCommandOpen(false);
          }}
          onCreateDocument={() => {
            createDocument();
            setCommandOpen(false);
          }}
        />
      ) : null}

      {confirm ? <ConfirmDialog title={confirm.title} description={confirm.description} confirmLabel={confirm.confirmLabel} onCancel={() => setConfirm(null)} onConfirm={confirm.onConfirm} /> : null}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </main>
  );
}
