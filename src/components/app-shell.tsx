"use client";

import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Home as HomeIcon,
  Import,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Paperclip,
  PanelRight,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Session } from "@supabase/supabase-js";
import clsx from "clsx";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  createBlankDocument,
  createBlankNote,
  createBlankTodo,
  createDefaultSpace,
  emptyWorkspace,
  importLocalWorkspace,
  listWorkspaceData,
  repository,
} from "@/lib/repository";
import type { Attachment, DocumentItem, Note, SaveState, Space, Todo, TodoFilter, TodoViewMode, ViewKey, WorkspaceData } from "@/lib/types";
import { ConfirmDialog, EmptyState, IconButton, LoadingState, PrimaryButton, ToastStack } from "@/components/ui";
import type { ToastMessage } from "@/components/ui";

const views: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "todos", label: "Todo", icon: CheckCircle2 },
  { key: "notes", label: "想法", icon: Lightbulb },
  { key: "documents", label: "知识库", icon: BookOpen },
  { key: "settings", label: "设置", icon: Settings },
];

const viewLabels: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  todos: "Todo",
  notes: "想法",
  documents: "知识库",
  settings: "设置",
};

const spaceColors = ["#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c", "#475569"];

const todoColumns: Array<{ status: Todo["status"]; label: string; color: string }> = [
  { status: "todo", label: "待办", color: "bg-sky-500" },
  { status: "doing", label: "进行中", color: "bg-amber-500" },
  { status: "done", label: "完成", color: "bg-emerald-500" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
};

const fileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
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

const parseTagInput = (value: string) =>
  value
    .split(/[,\s，]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
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

const priorityLabel = (priority: Todo["priority"]) => ({ low: "低", medium: "中", high: "高" })[priority];

const statusLabel = (status: Todo["status"]) => ({ todo: "待办", doing: "进行中", waiting: "等待", done: "完成" })[status];

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
  const [saveState, setSaveState] = useState<SaveState>("idle");
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const client = session && supabase ? supabase : null;
  const cloudMode = Boolean(client);
  const userId = session?.user.id ?? (isSupabaseConfigured ? undefined : "local-user");

  const activeSpace = workspace.spaces.find((space) => space.id === activeSpaceId) ?? workspace.spaces[0] ?? null;
  const activeNote = workspace.notes.find((note) => note.id === activeNoteId) ?? null;
  const activeDocument = workspace.documents.find((document) => document.id === activeDocumentId) ?? null;

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
      if (saveState !== "saving") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

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
    const now = new Date();
    return scopedData.todos.filter((todo) => {
      if (todoFilter === "done") return todo.status === "done";
      if (todoFilter === "today") return todo.due_date ? new Date(todo.due_date).toDateString() === now.toDateString() : false;
      if (todoFilter === "overdue") return todo.due_date ? new Date(todo.due_date) < now && todo.status !== "done" : false;
      return true;
    });
  }, [scopedData.todos, todoFilter]);

  const scopedTagStats = useMemo(() => tagStatsFrom([...scopedData.notes, ...scopedData.documents, ...scopedData.todos], 32), [scopedData.documents, scopedData.notes, scopedData.todos]);

  const contextTodos = useMemo(() => {
    const entityTags = view === "notes" ? activeNote?.tags ?? [] : view === "documents" ? activeDocument?.tags ?? [] : [];
    if (!entityTags.length) return scopedData.todos;
    const tagSet = new Set(entityTags);
    return scopedData.todos.filter((todo) => todo.tags.some((tag) => tagSet.has(tag)));
  }, [activeDocument, activeNote, scopedData.todos, view]);

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

  const scheduleSave = <T,>(item: T, save: (item: T) => Promise<unknown>) => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await save(item);
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1200);
      } catch (error) {
        setSaveState("error");
        toast("error", "保存失败", error instanceof Error ? error.message : "请稍后重试");
      }
    }, 450);
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
    scheduleSave(note, (item) => repository.upsertNote(client, item));
  };

  const deleteNote = (note: Note) => {
    setConfirm({
      title: "删除想法",
      description: `确定删除「${note.title}」吗？此操作不可撤销。`,
      confirmLabel: "删除",
      onConfirm: () => {
        const nextNotes = workspace.notes.filter((item) => item.id !== note.id);
        setActiveNoteId(nextNotes[0]?.id ?? null);
        setConfirm(null);
        runOptimistic({ ...workspace, notes: nextNotes }, () => repository.deleteNote(client, note.id), "已删除想法");
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
    scheduleSave(document, (item) => repository.upsertDocument(client, item));
  };

  const deleteDocument = (document: DocumentItem) => {
    setConfirm({
      title: "删除文档",
      description: `确定删除「${document.title}」吗？此操作不可撤销。`,
      confirmLabel: "删除",
      onConfirm: () => {
        const nextDocuments = workspace.documents.filter((item) => item.id !== document.id);
        setActiveDocumentId(nextDocuments[0]?.id ?? null);
        setConfirm(null);
        runOptimistic({ ...workspace, documents: nextDocuments }, () => repository.deleteDocument(client, document.id), "已删除文档");
      },
    });
  };

  const createTodo = async (patch?: Partial<Todo>) => {
    if (!activeSpace?.id) return;
    const todo = createBlankTodo(activeSpace.id, userId, patch);
    setActiveSpaceId(activeSpace.id);
    setTodoFilter("all");
    switchView("todos");
    await runOptimistic({ ...workspace, todos: [todo, ...workspace.todos] }, () => repository.upsertTodo(client, todo), "已创建 Todo");
  };

  const saveTodo = (todo: Todo) => {
    const nextTodo = { ...todo, updated_at: new Date().toISOString() };
    const next = { ...workspace, todos: workspace.todos.map((item) => (item.id === todo.id ? nextTodo : item)) };
    const previous = workspace;
    setWorkspace(next);
    repository.upsertTodo(client, nextTodo).catch((error) => {
      setWorkspace(previous);
      toast("error", "保存 Todo 失败", error instanceof Error ? error.message : "请稍后重试");
    });
  };

  const advanceTodo = (todo: Todo) => {
    const nextStatus: Todo["status"] = todo.status === "todo" ? "doing" : todo.status === "doing" || todo.status === "waiting" ? "done" : "todo";
    saveTodo({ ...todo, status: nextStatus });
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
      const data = { ...emptyWorkspace(), ...JSON.parse(await readFileAsText(file)) } as WorkspaceData;
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
          saveState={saveState}
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
          saveState={saveState}
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
          onDropStatus={(todo, status) => saveTodo({ ...todo, status })}
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

function LoginView({ authEmail, authMessage, onEmailChange, onSignIn }: { authEmail: string; authMessage: string; onEmailChange: (value: string) => void; onSignIn: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--app-bg)] p-6 text-[var(--app-fg)]">
      <section className="w-full max-w-md rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lift)]">
        <span className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--selected)] px-4 text-sm font-medium text-[var(--accent)]">
          <HomeIcon className="h-4 w-4" />
          Personal OS
        </span>
        <h1 className="mt-6 text-2xl font-semibold">登录你的工作区</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">输入邮箱后会收到一次性登录链接。</p>
        <input className="mt-6 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 text-sm outline-none focus:border-[var(--accent)]" type="email" value={authEmail} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@example.com" />
        <PrimaryButton onClick={onSignIn} disabled={!authEmail.trim()}>
          <Sparkles className="h-4 w-4" />
          发送登录链接
        </PrimaryButton>
        {authMessage ? <p className="mt-4 rounded-xl bg-[var(--panel-soft)] p-3 text-sm text-[var(--muted)]">{authMessage}</p> : null}
      </section>
    </main>
  );
}

function Sidebar({
  open,
  spaces,
  spaceStats,
  activeSpace,
  view,
  theme,
  onClose,
  onThemeChange,
  onViewChange,
  onSelectSpace,
  onUpdateSpace,
  onCreateSpace,
  onDeleteSpace,
}: {
  open: boolean;
  spaces: Space[];
  spaceStats: Record<string, SpaceStats>;
  activeSpace: Space | null;
  view: ViewKey;
  theme: "light" | "dark";
  onClose: () => void;
  onThemeChange: () => void;
  onViewChange: (view: ViewKey) => void;
  onSelectSpace: (spaceId: string) => void;
  onUpdateSpace: (space: Space) => void;
  onCreateSpace: () => void;
  onDeleteSpace: (space: Space) => void;
}) {
  return (
    <aside className={clsx("fixed inset-y-0 left-0 z-40 flex w-[280px] -translate-x-full flex-col border-r border-[var(--border)] bg-[var(--sidebar)] p-4 transition-transform duration-200 lg:static lg:translate-x-0", open && "translate-x-0")}>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-ink)]">
          <HomeIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Personal OS</p>
          <p className="text-xs text-[var(--muted)]">本地优先知识工作台</p>
        </div>
        <IconButton className="lg:hidden" label="关闭侧边栏" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <nav className="space-y-1">
        {views.map((item) => (
          <button key={item.key} className={clsx("flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition hover:bg-[var(--hover)]", view === item.key && "bg-[var(--selected)] text-[var(--accent)]")} onClick={() => onViewChange(item.key)}>
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-7 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        <span>Knowledge Bases</span>
        <IconButton label="新建知识库" onClick={onCreateSpace}>
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="mt-2 space-y-2 overflow-y-auto pr-1">
        {spaces.map((space) => (
          <div key={space.id} className={clsx("group rounded-xl p-3 transition", activeSpace?.id === space.id ? "bg-[var(--selected)]" : "hover:bg-[var(--hover)]")}>
            <button className="flex w-full items-start gap-2 text-left" onClick={() => onSelectSpace(space.id)}>
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: space.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{space.name}</span>
                <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{space.description}</span>
                <span className="mt-2 block truncate text-[11px] text-[var(--muted)]">
                  {(spaceStats[space.id]?.notes ?? 0)} 想法 · {(spaceStats[space.id]?.documents ?? 0)} 文档 · {(spaceStats[space.id]?.openTodos ?? 0)} 待办
                </span>
              </span>
            </button>
            {activeSpace?.id === space.id ? (
              <div className="mt-3 grid gap-2">
                <input className="h-8 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-xs" value={space.name} onChange={(event) => onUpdateSpace({ ...space, name: event.target.value })} aria-label="知识库名称" />
                <textarea className="min-h-14 resize-none rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs leading-5" value={space.description} onChange={(event) => onUpdateSpace({ ...space, description: event.target.value })} aria-label="知识库描述" />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {spaceColors.map((color) => (
                      <button key={color} className={clsx("size-5 rounded-full border", space.color === color ? "border-[var(--app-fg)]" : "border-transparent")} style={{ backgroundColor: color }} onClick={() => onUpdateSpace({ ...space, color })} aria-label={`设置颜色 ${color}`} />
                    ))}
                  </div>
                  {spaces.length > 1 ? (
                    <IconButton label="删除知识库" onClick={() => onDeleteSpace(space)}>
                      <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                    </IconButton>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-[var(--border)] pt-4">
        <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition hover:bg-[var(--hover)]" onClick={onThemeChange}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "浅色模式" : "深色模式"}
        </button>
      </div>
    </aside>
  );
}

function TopBar({
  activeSpace,
  view,
  query,
  onMenu,
  onSearch,
  onCommand,
  onContext,
  onNew,
}: {
  activeSpace: Space | null;
  view: ViewKey;
  query: string;
  onMenu: () => void;
  onSearch: (value: string) => void;
  onCommand: () => void;
  onContext: () => void;
  onNew: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--app-bg)]/82 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <IconButton className="lg:hidden" label="打开侧边栏" onClick={onMenu}>
          <Menu className="h-4 w-4" />
        </IconButton>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{viewLabels[view]}</p>
          <p className="truncate text-xs text-[var(--muted)]">{activeSpace ? `${activeSpace.name} · ${activeSpace.description}` : "选择或创建一个知识库"}</p>
        </div>
        <button className="ml-auto hidden h-9 min-w-[280px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 text-left text-sm text-[var(--muted)] lg:flex xl:min-w-[360px]" onClick={onCommand}>
          <Search className="h-4 w-4" />
          <input className="min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={(event) => onSearch(event.target.value)} placeholder="搜索或按 Ctrl K 执行命令..." onClick={(event) => event.stopPropagation()} />
          <kbd className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
        </button>
        <IconButton className="xl:hidden" label="打开上下文" onClick={onContext}>
          <PanelRight className="h-4 w-4" />
        </IconButton>
        <button className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-medium text-[var(--accent-ink)] shadow-sm transition hover:brightness-105 active:scale-[0.98] sm:w-auto sm:px-3" onClick={onNew} aria-label="新建">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:ml-2 sm:inline">新建</span>
        </button>
      </div>
    </header>
  );
}

function DashboardView({
  notes,
  documents,
  todos,
  attachments,
  activeSpace,
  query,
  globalSearch,
  onQueryChange,
  onGlobalSearchChange,
  onOpenCommand,
  onNewIdea,
  onNewTodo,
  onNewDocument,
  onSelectNote,
  onSelectDocument,
  onUpload,
}: {
  notes: Note[];
  documents: DocumentItem[];
  todos: Todo[];
  attachments: Attachment[];
  activeSpace: Space | null;
  query: string;
  globalSearch: boolean;
  onQueryChange: (value: string) => void;
  onGlobalSearchChange: (value: boolean) => void;
  onOpenCommand: () => void;
  onNewIdea: () => void;
  onNewTodo: () => void;
  onNewDocument: () => void;
  onSelectNote: (id: string) => void;
  onSelectDocument: (id: string) => void;
  onUpload: () => void;
}) {
  const doneCount = todos.filter((todo) => todo.status === "done").length;
  const openCount = todos.length - doneCount;
  const progress = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const updatedToday = notes.filter((note) => note.updated_at && new Date(note.updated_at) >= todayStart).length;
  const editedDocs = documents.filter((document) => document.content.trim().length > 0).length;
  const highPriorityCount = todos.filter((todo) => todo.status !== "done" && todo.priority === "high").length;
  const totalAttachmentSize = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
  const pinnedNotes = [...notes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))).slice(0, 5);
  const recentTodo = todos.find((todo) => todo.status !== "done");
  const knowledgeNodes = tagStatsFrom([...notes, ...documents, ...todos], 5);

  return (
    <div className="dashboard-shell">
      <section className="dashboard-command rounded-[20px] border border-[var(--command-border)]/10 bg-[var(--command)] p-3 shadow-[var(--shadow-command)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <button className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--input)] px-4 text-left text-sm text-[var(--muted)] transition hover:border-[var(--accent)]" onClick={onOpenCommand}>
            <Search className="h-4 w-4" />
            <input className="min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="快速搜索、切换空间或执行命令" onClick={(event) => event.stopPropagation()} />
            <kbd className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px]">Ctrl K</kbd>
          </button>
          <div className="flex flex-wrap gap-2">
            <DashboardAction icon={Lightbulb} label="记想法" onClick={onNewIdea} />
            <DashboardAction icon={CheckCircle2} label="新 Todo" onClick={onNewTodo} />
            <DashboardAction icon={FileText} label="新知识文档" onClick={onNewDocument} />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="想法" value={notes.length} delta={`${updatedToday} 今日更新`} icon={Lightbulb} />
        <MetricCard label="知识库文档" value={documents.length} delta={`${editedDocs} 有内容`} icon={BookOpen} />
        <MetricCard label="待办" value={openCount} delta={`${progress}% 完成`} icon={ListChecks} />
        <MetricCard label="附件" value={attachments.length} delta={fileSize(totalAttachmentSize)} icon={Paperclip} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <DashboardPanel title="置顶与最近想法" icon={Lightbulb} action={`${pinnedNotes.length}/${notes.length}`}>
          <div className="space-y-3">
            {pinnedNotes.length ? (
              pinnedNotes.map((note) => (
                <button key={note.id} className="focus-card block w-full rounded-2xl border border-[var(--border)] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]" onClick={() => onSelectNote(note.id)}>
                  <div className="flex items-center gap-2">
                    {note.pinned ? <Star className="h-4 w-4 text-[var(--accent)]" /> : null}
                    <p className="truncate font-semibold">{note.title}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{plainText(note.content) || "还没有内容"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {note.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="meta-chip rounded-lg px-2 py-1 text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <EmptyInline text="没有匹配的想法。" />
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel title="当前空间待办" icon={CheckCircle2} action={`${doneCount}/${todos.length} 完成 · ${highPriorityCount} 高`}>
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-[var(--panel-soft)] p-3">
            <div>
              <p className="text-sm font-semibold">{recentTodo?.title ?? "暂无待办"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{recentTodo ? `${priorityLabel(recentTodo.priority)}优先级 · ${formatDate(recentTodo.due_date)}` : `0 个进行中的任务 · ${activeSpace?.name ?? "全部空间"}`}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
              <input className="accent-[var(--accent)]" type="checkbox" checked={globalSearch} onChange={(event) => onGlobalSearchChange(event.target.checked)} />
              全局搜索
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {todoColumns.map((column) => {
              const items = todos.filter((todo) => todo.status === column.status || (column.status === "doing" && todo.status === "waiting"));
              return (
                <div key={column.status} className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <span className={clsx("size-2 rounded-full", column.color)} />
                    {column.label}
                    <span className="text-xs font-normal text-[var(--muted)]">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.slice(0, 4).map((todo) => (
                      <div key={todo.id} className="rounded-xl bg-[var(--panel)] px-3 py-2 shadow-[0_1px_1px_rgb(24_24_22_/_0.03)]">
                        <p className="truncate text-sm font-medium">{todo.title}</p>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">{todo.tags.map((tag) => `#${tag}`).join(" ") || statusLabel(todo.status)}</p>
                      </div>
                    ))}
                    {!items.length ? <p className="rounded-xl bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted)]">没有任务</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardPanel>
      </section>

      <section className="mt-6 grid gap-6 2xl:grid-cols-[1fr_0.9fr]">
        <DashboardPanel title="知识文档" icon={BookOpen} action={`${documents.length} 篇`}>
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="space-y-2">
              {documents.slice(0, 6).map((document) => (
                <button key={document.id} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-[var(--soft)]" onClick={() => onSelectDocument(document.id)}>
                  <span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{document.title}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--muted)]">{document.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ") || `${document.content.trim().length} 字符`}</span>
                  </span>
                  <span className="text-xs text-[var(--muted)]">{formatDate(document.updated_at)}</span>
                </button>
              ))}
              {!documents.length ? <EmptyInline text="还没有知识文档。" /> : null}
            </div>
            <div className="knowledge-map relative hidden min-h-48 place-items-center lg:grid">
              <span className="absolute left-1/2 top-1/2 h-px w-36 -translate-x-1/2 bg-[var(--border)]" />
              <span className="absolute left-1/2 top-1/2 h-32 w-px -translate-y-1/2 bg-[var(--border)]" />
              {(knowledgeNodes.length ? knowledgeNodes : [{ tag: "想法", count: notes.length }, { tag: "文档", count: documents.length }, { tag: "Todo", count: todos.length }]).map((node, index) => (
                <span key={node.tag} className={clsx("absolute rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs", index === 0 && "left-2 top-7", index === 1 && "right-1 top-9", index === 2 && "bottom-8 left-2", index === 3 && "bottom-8 right-1", index === 4 && "bottom-1 left-1/2 -translate-x-1/2")}>
                  #{node.tag} <span className="text-[var(--muted)]">{node.count}</span>
                </span>
              ))}
              <span className="relative z-10 grid size-14 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_18px_38px_color-mix(in_srgb,var(--accent)_28%,transparent)]">
                <BookOpen className="h-6 w-6" />
              </span>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel title="最近附件" icon={Paperclip} action={fileSize(totalAttachmentSize)}>
          <div className="grid gap-3 sm:grid-cols-2">
            {attachments.slice(0, 4).map((attachment) => (
              <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--selected)] text-[var(--accent)]">
                  <Paperclip className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{attachment.name}</span>
                  <span className="mt-1 block truncate text-xs text-[var(--muted)]">{fileSize(attachment.size)} · {formatDate(attachment.created_at)}</span>
                </span>
              </div>
            ))}
            {!attachments.length ? <EmptyInline text="暂无附件。" /> : null}
            <button className="grid min-h-16 place-items-center rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={onUpload}>
              <span className="inline-flex items-center gap-2">
                <Upload className="h-4 w-4" />
                上传文件
              </span>
            </button>
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}

function IdeasView({
  ideas,
  activeIdea,
  saveState,
  analyzingIdeaIds,
  onSelect,
  onNew,
  onPatch,
  onDelete,
  onAnalyze,
}: {
  ideas: Note[];
  activeIdea: Note | null;
  saveState: SaveState;
  analyzingIdeaIds: string[];
  onSelect: (id: string) => void;
  onNew: (content?: string) => void;
  onPatch: (id: string, patch: Partial<Note>) => void;
  onDelete: (note: Note) => void;
  onAnalyze: (note: Note) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <WorkspaceViewShell>
      <WorkspaceViewHeader
        title="想法"
        subtitles={[`${ideas.length} 条灵感`, saveState === "saving" ? "正在保存" : saveState === "saved" ? "已保存" : "自动保存"]}
        actions={
          <PrimaryButton onClick={() => onNew()}>
            <Plus className="h-4 w-4" />
            新想法
          </PrimaryButton>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="quiet-card rounded-2xl p-3">
            <textarea className="min-h-28 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--input)] p-3 text-sm leading-6 outline-none focus:border-[var(--accent)]" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="快速记录一个想法，支持 #标签" />
            <div className="mt-3 flex justify-end">
              <PrimaryButton
                onClick={() => {
                  onNew(draft);
                  setDraft("");
                }}
                disabled={!draft.trim()}
              >
                <Lightbulb className="h-4 w-4" />
                记录
              </PrimaryButton>
            </div>
          </div>
          <div className="space-y-2">
            {ideas.map((idea) => (
              <button key={idea.id} className={clsx("quiet-card block w-full rounded-2xl p-4 text-left transition hover:-translate-y-0.5", activeIdea?.id === idea.id && "ring-2 ring-[var(--accent)]/40")} onClick={() => onSelect(idea.id)}>
                <p className="flex items-center gap-2 truncate font-semibold">{idea.pinned ? <Star className="h-4 w-4 text-[var(--accent)]" /> : null}{idea.title}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{plainText(idea.content) || "暂无内容"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {idea.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="meta-chip rounded-lg px-2 py-1 text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
            {!ideas.length ? <EmptyState title="没有想法" description="记录一个想法后，它会出现在这里。" /> : null}
          </div>
        </div>
        <div className="quiet-card min-h-[640px] rounded-2xl p-4">
          {activeIdea ? (
            <div className="flex h-full flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <input className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-lg font-semibold outline-none focus:border-[var(--accent)]" value={activeIdea.title} onChange={(event) => onPatch(activeIdea.id, { title: event.target.value })} aria-label="想法标题" />
                <IconButton label={activeIdea.pinned ? "取消置顶" : "置顶"} onClick={() => onPatch(activeIdea.id, { pinned: !activeIdea.pinned })}>
                  <Star className={clsx("h-4 w-4", activeIdea.pinned && "fill-[var(--accent)] text-[var(--accent)]")} />
                </IconButton>
                <IconButton label="AI 分析" disabled={analyzingIdeaIds.includes(activeIdea.id)} onClick={() => onAnalyze(activeIdea)}>
                  <Sparkles className="h-4 w-4" />
                </IconButton>
                <IconButton label="删除想法" onClick={() => onDelete(activeIdea)}>
                  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                </IconButton>
              </div>
              <textarea className="min-h-[360px] flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--input)] p-4 text-sm leading-7 outline-none focus:border-[var(--accent)]" value={activeIdea.content} onChange={(event) => onPatch(activeIdea.id, { content: event.target.value, title: titleFromContent(event.target.value, activeIdea.title) })} placeholder="写下想法，使用 #标签 组织它。" />
              <input className="rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" value={activeIdea.tags.join(", ")} onChange={(event) => onPatch(activeIdea.id, { tags: parseTagInput(event.target.value) })} aria-label="想法标签" />
              {activeIdea.ai_summary ? (
                <div className="rounded-2xl bg-[var(--panel-soft)] p-4">
                  <p className="text-sm font-semibold">AI 摘要</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{activeIdea.ai_summary}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState title="选择一个想法" description="从左侧列表选择，或新建一个想法开始记录。" />
          )}
        </div>
      </section>
    </WorkspaceViewShell>
  );
}

function KnowledgeBaseView({
  documents,
  activeDocument,
  saveState,
  onSelect,
  onPatch,
  onNew,
  onDelete,
  onImport,
  onExport,
  onTogglePinned,
  onArchive,
}: {
  documents: DocumentItem[];
  activeDocument: DocumentItem | null;
  saveState: SaveState;
  onSelect: (id: string) => void;
  onPatch: (patch: Partial<DocumentItem>) => void;
  onNew: () => void;
  onDelete: (document: DocumentItem) => void;
  onImport: () => void;
  onExport: (document: DocumentItem) => void;
  onTogglePinned: (document: DocumentItem) => void;
  onArchive: (document: DocumentItem) => void;
}) {
  return (
    <WorkspaceViewShell>
      <WorkspaceViewHeader
        title="知识库"
        subtitles={[`${documents.length} 篇 Markdown 文档`, saveState === "saving" ? "正在保存" : saveState === "saved" ? "已保存" : "支持预览与导入"]}
        actions={
          <div className="flex gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm transition hover:bg-[var(--hover)]" onClick={onImport}>
              <Import className="h-4 w-4" />
              导入
            </button>
            <PrimaryButton onClick={onNew}>
              <Plus className="h-4 w-4" />
              新文档
            </PrimaryButton>
          </div>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-2">
          {documents.map((document) => (
            <button key={document.id} className={clsx("quiet-card block w-full rounded-2xl p-4 text-left transition hover:-translate-y-0.5", activeDocument?.id === document.id && "ring-2 ring-[var(--accent)]/40")} onClick={() => onSelect(document.id)}>
              <p className="flex items-center gap-2 truncate font-semibold">{document.pinned ? <Star className="h-4 w-4 text-[var(--accent)]" /> : null}{document.title}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{document.content}</p>
              <p className="mt-3 text-xs text-[var(--muted)]">{formatDate(document.updated_at)}</p>
            </button>
          ))}
          {!documents.length ? <EmptyState title="没有文档" description="新建或导入 Markdown 文档后会出现在这里。" /> : null}
        </div>
        <div className="quiet-card rounded-2xl p-4">
          {activeDocument ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <input className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-lg font-semibold outline-none focus:border-[var(--accent)]" value={activeDocument.title} onChange={(event) => onPatch({ title: event.target.value })} aria-label="文档标题" />
                <IconButton label={activeDocument.pinned ? "取消置顶" : "置顶"} onClick={() => onTogglePinned(activeDocument)}>
                  <Star className={clsx("h-4 w-4", activeDocument.pinned && "fill-[var(--accent)] text-[var(--accent)]")} />
                </IconButton>
                <IconButton label="导出 Markdown" onClick={() => onExport(activeDocument)}>
                  <Download className="h-4 w-4" />
                </IconButton>
                <IconButton label={activeDocument.archived ? "恢复文档" : "归档文档"} onClick={() => onArchive(activeDocument)}>
                  <ChevronDown className="h-4 w-4" />
                </IconButton>
                <IconButton label="删除文档" onClick={() => onDelete(activeDocument)}>
                  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                </IconButton>
              </div>
              <input className="w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" value={activeDocument.tags.join(", ")} onChange={(event) => onPatch({ tags: parseTagInput(event.target.value) })} aria-label="文档标签" />
              <div className="grid gap-4 2xl:grid-cols-2">
                <textarea className="min-h-[560px] resize-y rounded-2xl border border-[var(--border)] bg-[var(--input)] p-4 font-mono text-sm leading-7 outline-none focus:border-[var(--accent)]" value={activeDocument.content} onChange={(event) => onPatch({ content: event.target.value })} aria-label="Markdown 内容" />
                <article className="markdown min-h-[560px] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeDocument.content || "开始编写 Markdown..."}</ReactMarkdown>
                </article>
              </div>
            </div>
          ) : (
            <EmptyState title="选择一个文档" description="从左侧列表选择，或新建一个 Markdown 文档。" />
          )}
        </div>
      </section>
    </WorkspaceViewShell>
  );
}

function TodosView({
  todos,
  mode,
  filter,
  onModeChange,
  onFilterChange,
  onSave,
  onAdvance,
  onDropStatus,
  onDelete,
  onClearDone,
  onNew,
}: {
  todos: Todo[];
  mode: TodoViewMode;
  filter: TodoFilter;
  onModeChange: (mode: TodoViewMode) => void;
  onFilterChange: (filter: TodoFilter) => void;
  onSave: (todo: Todo) => void;
  onAdvance: (todo: Todo) => void;
  onDropStatus: (todo: Todo, status: Todo["status"]) => void;
  onDelete: (todo: Todo) => void;
  onClearDone: () => void;
  onNew: (patch?: Partial<Todo>) => void;
}) {
  return (
    <WorkspaceViewShell>
      <WorkspaceViewHeader
        title="Todo"
        subtitles={[`${todos.length} 个任务`, mode === "board" ? "看板视图" : "列表视图"]}
        actions={
          <PrimaryButton onClick={() => onNew()}>
            <Plus className="h-4 w-4" />
            新 Todo
          </PrimaryButton>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "today", "overdue", "done"] as TodoFilter[]).map((item) => (
          <button key={item} className={clsx("h-9 rounded-xl border border-[var(--border)] px-3 text-sm transition hover:bg-[var(--hover)]", filter === item && "bg-[var(--selected)] text-[var(--accent)]")} onClick={() => onFilterChange(item)}>
            {item === "all" ? "全部" : item === "today" ? "今天" : item === "overdue" ? "逾期" : "完成"}
          </button>
        ))}
        <button className={clsx("h-9 rounded-xl border border-[var(--border)] px-3 text-sm transition hover:bg-[var(--hover)]", mode === "board" && "bg-[var(--selected)] text-[var(--accent)]")} onClick={() => onModeChange(mode === "board" ? "list" : "board")}>
          {mode === "board" ? "看板" : "列表"}
        </button>
        <button className="h-9 rounded-xl border border-[var(--border)] px-3 text-sm transition hover:bg-[var(--hover)]" onClick={onClearDone}>
          清理完成项
        </button>
      </div>
      {mode === "board" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {todoColumns.map((column) => (
            <TodoColumn key={column.status} column={column} todos={todos.filter((todo) => todo.status === column.status || (column.status === "doing" && todo.status === "waiting"))} onSave={onSave} onAdvance={onAdvance} onDropStatus={onDropStatus} onDelete={onDelete} onNew={onNew} />
          ))}
        </div>
      ) : (
        <div className="quiet-card overflow-hidden rounded-2xl">
          {todos.map((todo) => (
            <TodoRow key={todo.id} todo={todo} onSave={onSave} onAdvance={onAdvance} onDelete={onDelete} />
          ))}
          {!todos.length ? <p className="p-5 text-sm text-[var(--muted)]">没有匹配的 Todo。</p> : null}
        </div>
      )}
    </WorkspaceViewShell>
  );
}

function TodoColumn({ column, todos, onSave, onAdvance, onDropStatus, onDelete, onNew }: { column: { status: Todo["status"]; label: string; color: string }; todos: Todo[]; onSave: (todo: Todo) => void; onAdvance: (todo: Todo) => void; onDropStatus: (todo: Todo, status: Todo["status"]) => void; onDelete: (todo: Todo) => void; onNew: (patch?: Partial<Todo>) => void }) {
  return (
    <section
      className="quiet-card min-h-[420px] rounded-2xl p-4"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData("application/x-personal-os-todo");
        if (!raw) return;
        try {
          const todo = JSON.parse(raw) as Todo;
          onDropStatus(todo, column.status);
        } catch {
          // Ignore malformed drag payloads from outside the app.
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-semibold">
          <span className={clsx("size-2 rounded-full", column.color)} />
          {column.label}
          <span className="text-sm font-normal text-[var(--muted)]">{todos.length}</span>
        </h2>
        <IconButton label={`新建${column.label}任务`} onClick={() => onNew({ status: column.status })}>
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="space-y-3">
        {todos.map((todo) => (
          <TodoCard key={todo.id} todo={todo} onSave={onSave} onAdvance={onAdvance} onDelete={onDelete} />
        ))}
        {!todos.length ? <p className="rounded-xl bg-[var(--panel-soft)] p-3 text-sm text-[var(--muted)]">暂无任务</p> : null}
      </div>
    </section>
  );
}

function TodoCard({ todo, onSave, onAdvance, onDelete }: { todo: Todo; onSave: (todo: Todo) => void; onAdvance: (todo: Todo) => void; onDelete: (todo: Todo) => void }) {
  return (
    <article
      className="cursor-grab rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[0_1px_1px_rgb(24_24_22_/_0.03)] active:cursor-grabbing"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-personal-os-todo", JSON.stringify(todo));
        event.dataTransfer.setData("text/plain", todo.id);
      }}
    >
      <input draggable={false} className="w-full rounded-lg bg-transparent text-sm font-semibold outline-none focus:bg-[var(--input)]" value={todo.title} onChange={(event) => onSave({ ...todo, title: event.target.value })} aria-label="Todo 标题" />
      <textarea draggable={false} className="mt-2 min-h-16 w-full resize-none rounded-lg bg-[var(--panel-soft)] p-2 text-xs leading-5 outline-none focus:bg-[var(--input)]" value={todo.description ?? ""} onChange={(event) => onSave({ ...todo, description: event.target.value })} aria-label="Todo 描述" placeholder="补充说明" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select draggable={false} className="h-8 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-xs" value={todo.priority} onChange={(event) => onSave({ ...todo, priority: event.target.value as Todo["priority"] })} aria-label="优先级">
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
        <input draggable={false} className="h-8 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-xs" type="datetime-local" value={todo.due_date?.slice(0, 16) ?? ""} onChange={(event) => onSave({ ...todo, due_date: event.target.value ? new Date(event.target.value).toISOString() : null })} aria-label="截止日期" />
        <button className="ml-auto h-8 rounded-lg bg-[var(--selected)] px-2 text-xs text-[var(--accent)]" onClick={() => onAdvance(todo)}>
          推进
        </button>
        <IconButton label="删除 Todo" onClick={() => onDelete(todo)}>
          <Trash2 className="h-4 w-4 text-[var(--danger)]" />
        </IconButton>
      </div>
    </article>
  );
}

function TodoRow({ todo, onSave, onAdvance, onDelete }: { todo: Todo; onSave: (todo: Todo) => void; onAdvance: (todo: Todo) => void; onDelete: (todo: Todo) => void }) {
  return (
    <article className="flex flex-col gap-3 border-b border-[var(--border)] p-4 last:border-b-0 md:flex-row md:items-center">
      <button className={clsx("grid size-8 shrink-0 place-items-center rounded-full border", todo.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border)]")} onClick={() => onAdvance(todo)} aria-label="切换 Todo 状态">
        <CheckCircle2 className="h-4 w-4" />
      </button>
      <input className="min-w-0 flex-1 rounded-lg bg-transparent text-sm font-semibold outline-none focus:bg-[var(--input)]" value={todo.title} onChange={(event) => onSave({ ...todo, title: event.target.value })} aria-label="Todo 标题" />
      <select className="h-9 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-sm" value={todo.status} onChange={(event) => onSave({ ...todo, status: event.target.value as Todo["status"] })} aria-label="Todo 状态">
        <option value="todo">待办</option>
        <option value="doing">进行中</option>
        <option value="waiting">等待</option>
        <option value="done">完成</option>
      </select>
      <IconButton label="删除 Todo" onClick={() => onDelete(todo)}>
        <Trash2 className="h-4 w-4 text-[var(--danger)]" />
      </IconButton>
    </article>
  );
}

function ContextPanel({
  open,
  onClose,
  tagStats,
  selectedTag,
  onTagSelect,
  attachments,
  activeSpace,
  activeNote,
  activeDocument,
  todos,
  view,
  uploadingNames,
  onUpload,
  onDeleteAttachment,
  onInsertImage,
}: {
  open: boolean;
  onClose: () => void;
  tagStats: TagStat[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
  attachments: Attachment[];
  activeSpace: Space | null;
  activeNote: Note | null;
  activeDocument: DocumentItem | null;
  todos: Todo[];
  view: ViewKey;
  uploadingNames: string[];
  onUpload: () => void;
  onDeleteAttachment: (attachment: Attachment) => void;
  onInsertImage: (attachment: Attachment) => void;
}) {
  const activeTitle = view === "notes" ? activeNote?.title : view === "documents" ? activeDocument?.title : activeSpace?.name;
  const relatedTodos = todos.filter((todo) => todo.status !== "done").slice(0, 3);
  const openTodoCount = todos.filter((todo) => todo.status !== "done").length;
  const doneTodoCount = todos.length - openTodoCount;
  const topTag = tagStats[0];
  const activeSummary =
    view === "notes" && activeNote
      ? `${activeNote.tags.length} 个标签 · ${activeNote.ai_summary ? "已生成 AI 摘要" : "未分析"}`
      : view === "documents" && activeDocument
        ? `${activeDocument.content.trim().length} 字符 · ${activeDocument.tags.length} 个标签`
        : `${openTodoCount} 个未完成 Todo · ${doneTodoCount} 个已完成`;
  return (
    <aside className={clsx("fixed inset-x-0 bottom-0 z-50 max-h-[82vh] translate-y-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--panel)]/94 p-4 shadow-[var(--shadow-lift)] backdrop-blur-xl transition-transform duration-200 xl:static xl:block xl:max-h-none xl:translate-y-0 xl:rounded-none xl:border-y-0 xl:border-r-0 xl:bg-transparent xl:pt-20 xl:shadow-none", open && "translate-y-0")}>
      <div className="mb-4 flex items-center justify-between xl:hidden">
        <p className="text-sm font-semibold">上下文</p>
        <IconButton label="关闭上下文" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <section className="context-card mb-4 rounded-[18px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            AI Insight
          </h2>
          <Settings className="h-4 w-4 text-[var(--muted)]" />
        </div>
        <div className="rounded-xl bg-[var(--panel-soft)] p-4">
          <p className="text-sm font-semibold">{activeTitle ?? "未选择空间"}</p>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">{activeSummary}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{topTag ? `最高频标签是 #${topTag.tag}，出现 ${topTag.count} 次。` : "还没有可聚合的标签数据。"}</p>
        </div>
      </section>
      <section className="context-card mb-4 rounded-[18px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Related Todo</h2>
          <span className="text-sm text-[var(--muted)]">{relatedTodos.length}</span>
        </div>
        <div className="space-y-3">
          {relatedTodos.length ? relatedTodos.map((todo) => <div key={todo.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{todo.title}</span><span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600">{priorityLabel(todo.priority)}</span></div>) : <p className="text-sm text-[var(--muted)]">没有相关 Todo。</p>}
        </div>
      </section>
      <section className="context-card mb-4 rounded-[18px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tags</h2>
          <Tags className="h-4 w-4 text-[var(--muted)]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {tagStats.slice(0, 14).map(({ tag, count }) => (
            <button key={tag} className={clsx("rounded-lg bg-[var(--panel-soft)] px-3 py-2 text-sm", selectedTag === tag && "bg-[var(--selected)] text-[var(--accent)]")} onClick={() => onTagSelect(selectedTag === tag ? null : tag)}>
              #{tag} <span className="text-xs text-[var(--muted)]">{count}</span>
            </button>
          ))}
          {!tagStats.length ? <p className="text-sm text-[var(--muted)]">暂无标签。</p> : null}
        </div>
      </section>
      <section className="context-card rounded-[18px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Attachments</h2>
          <button className="text-sm text-[var(--muted)] hover:text-[var(--accent)]" onClick={onUpload}>上传</button>
        </div>
        <div className="space-y-3">
          {uploadingNames.map((name) => <p key={name} className="rounded-lg bg-[var(--panel-soft)] p-3 text-sm">{name}</p>)}
          {attachments.slice(0, 5).map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} onDelete={onDeleteAttachment} onInsertImage={onInsertImage} />)}
          {!attachments.length && !uploadingNames.length ? <p className="rounded-lg bg-[var(--panel-soft)] p-3 text-sm text-[var(--muted)]">暂无附件。</p> : null}
        </div>
      </section>
    </aside>
  );
}

function AttachmentRow({ attachment, onDelete, onInsertImage }: { attachment: Attachment; onDelete: (attachment: Attachment) => void; onInsertImage: (attachment: Attachment) => void }) {
  const canInsert = attachment.mime_type.startsWith("image/") && Boolean(attachment.url);
  return (
    <div className="rounded-lg bg-[var(--panel-soft)] p-3">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <a href={attachment.url} target="_blank" className="min-w-0 flex-1 truncate text-sm" rel="noreferrer">
          {attachment.name}
        </a>
        {canInsert ? (
          <IconButton label="插入图片" onClick={() => onInsertImage(attachment)}>
            <ChevronDown className="h-4 w-4" />
          </IconButton>
        ) : null}
        <IconButton label="删除附件" onClick={() => onDelete(attachment)}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">{fileSize(attachment.size)} · {formatDate(attachment.created_at)}</p>
    </div>
  );
}

function SettingsView({ cloudMode, session, onExportJson, onImportJson, onSignOut }: { cloudMode: boolean; session: Session | null; onExportJson: () => void; onImportJson: () => void; onSignOut: () => void }) {
  return (
    <WorkspaceViewShell>
      <WorkspaceViewHeader title="设置" subtitles={[cloudMode ? "Supabase 云同步" : "本地存储模式"]} />
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="quiet-card rounded-2xl p-4">
          <h2 className="font-semibold">账户</h2>
          <InfoRow label="当前模式" value={cloudMode ? "云端同步" : "本地模式"} />
          <InfoRow label="账号" value={session?.user.email ?? "local-user"} />
          {session ? (
            <button className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm transition hover:bg-[var(--hover)]" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          ) : null}
        </div>
        <div className="quiet-card rounded-2xl p-4">
          <h2 className="font-semibold">数据</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">导入导出包含空间、想法、文档、Todo 和附件元数据。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={onExportJson}>
              <Download className="h-4 w-4" />
              导出 JSON
            </PrimaryButton>
            <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm transition hover:bg-[var(--hover)]" onClick={onImportJson}>
              <Import className="h-4 w-4" />
              导入 JSON
            </button>
          </div>
        </div>
      </section>
    </WorkspaceViewShell>
  );
}

function CommandPalette({
  query,
  spaces,
  notes,
  documents,
  todos,
  onClose,
  onSearch,
  onView,
  onSpace,
  onNote,
  onDocument,
  onTodo,
  onCreateIdea,
  onCreateTodo,
  onCreateDocument,
}: {
  query: string;
  spaces: Space[];
  notes: Note[];
  documents: DocumentItem[];
  todos: Todo[];
  onClose: () => void;
  onSearch: (value: string) => void;
  onView: (view: ViewKey) => void;
  onSpace: (spaceId: string) => void;
  onNote: (noteId: string) => void;
  onDocument: (documentId: string) => void;
  onTodo: (todoId: string) => void;
  onCreateIdea: () => void;
  onCreateTodo: () => void;
  onCreateDocument: () => void;
}) {
  const search = query.trim().toLowerCase();
  const filteredNotes = notes.filter((note) => `${note.title} ${plainText(note.content)} ${note.tags.join(" ")}`.toLowerCase().includes(search)).slice(0, 5);
  const filteredDocuments = documents.filter((document) => `${document.title} ${document.content} ${document.tags.join(" ")}`.toLowerCase().includes(search)).slice(0, 5);
  const filteredTodos = todos.filter((todo) => `${todo.title} ${todo.description ?? ""} ${todo.tags.join(" ")}`.toLowerCase().includes(search)).slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 bg-black/30 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="mx-auto mt-[8vh] w-full max-w-2xl overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lift)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--border)] p-4">
          <Search className="h-4 w-4 text-[var(--muted)]" />
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" autoFocus value={query} onChange={(event) => onSearch(event.target.value)} placeholder="搜索内容、切换视图或创建新项目" />
          <IconButton label="关闭命令面板" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="max-h-[64vh] overflow-y-auto p-3">
          <CommandGroup title="快速操作">
            <CommandItem icon={Lightbulb} label="新建想法" detail="记录一条灵感" onClick={onCreateIdea} />
            <CommandItem icon={CheckCircle2} label="新建 Todo" detail="创建待办任务" onClick={onCreateTodo} />
            <CommandItem icon={FileText} label="新建知识文档" detail="创建 Markdown 文档" onClick={onCreateDocument} />
          </CommandGroup>
          <CommandGroup title="视图">
            {views.map((item) => <CommandItem key={item.key} icon={item.icon} label={item.label} detail="切换视图" onClick={() => onView(item.key)} />)}
          </CommandGroup>
          <CommandGroup title="空间">
            {spaces.map((space) => <CommandItem key={space.id} icon={BookOpen} label={space.name} detail={space.description} onClick={() => onSpace(space.id)} />)}
          </CommandGroup>
          <CommandGroup title="内容">
            {filteredNotes.map((note) => <CommandItem key={note.id} icon={Lightbulb} label={note.title} detail={plainText(note.content) || "想法"} onClick={() => onNote(note.id)} />)}
            {filteredDocuments.map((document) => <CommandItem key={document.id} icon={FileText} label={document.title} detail={document.tags.map((tag) => `#${tag}`).join(" ") || "文档"} onClick={() => onDocument(document.id)} />)}
            {filteredTodos.map((todo) => <CommandItem key={todo.id} icon={CheckCircle2} label={todo.title} detail={`${statusLabel(todo.status)} · ${priorityLabel(todo.priority)}优先级`} onClick={() => onTodo(todo.id)} />)}
          </CommandGroup>
        </div>
      </section>
    </div>
  );
}

function CommandGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CommandItem({ icon: Icon, label, detail, onClick }: { icon: typeof Lightbulb; label: string; detail: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--hover)]" onClick={onClick}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--panel-soft)] text-[var(--accent)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-[var(--muted)]">{detail}</span>
      </span>
    </button>
  );
}

function WorkspaceViewShell({ children }: { children: React.ReactNode }) {
  return <div className="animate-view-in space-y-5">{children}</div>;
}

function WorkspaceViewHeader({ title, subtitles, actions }: { title: string; subtitles: string[]; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitles.join(" · ")}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function DashboardAction({ icon: Icon, label, onClick }: { icon: typeof Lightbulb; label: string; onClick: () => void }) {
  return (
    <button className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-5 text-sm font-medium shadow-[0_1px_1px_rgb(24_24_22_/_0.03)] transition hover:border-[var(--accent)] hover:bg-[var(--selected)] hover:text-[var(--accent)] active:scale-[0.98]" onClick={onClick}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MetricCard({ label, value, delta, icon: Icon }: { label: string; value: number; delta: string; icon: typeof Lightbulb }) {
  return (
    <div className="metric-card flex h-[108px] items-center gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)]">
      <span className="grid size-12 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--app-fg)]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-[var(--muted)]">{label}</p>
        <div className="mt-1 flex items-end gap-3">
          <p className="text-[30px] font-semibold leading-none tabular-nums">{value}</p>
          <p className="pb-1 text-sm text-[var(--accent)]">{delta}</p>
        </div>
      </div>
    </div>
  );
}

function DashboardPanel({ title, icon: Icon, action, className, children }: { title: string; icon: typeof Lightbulb; action?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx("dashboard-panel rounded-[18px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)]", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-[17px] font-semibold">
          <Icon className="h-4 w-4 text-[var(--accent)]" />
          {title}
        </h2>
        {action ? (
          <span className="inline-flex items-center gap-1 text-sm text-[var(--muted)]">
            {action}
            <ChevronDown className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <p className="rounded-2xl bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">{text}</p>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-xl bg-[var(--panel-soft)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
  );
}
