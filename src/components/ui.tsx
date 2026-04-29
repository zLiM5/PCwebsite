"use client";

import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import clsx from "clsx";
import type React from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
};

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto animate-toast-in rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-lift)]">
          <div className="flex gap-3">
            <div
              className={clsx(
                "mt-0.5 grid h-6 w-6 place-items-center rounded-md",
                toast.tone === "success" && "bg-emerald-500/15 text-emerald-500",
                toast.tone === "error" && "bg-red-500/15 text-red-500",
                toast.tone === "info" && "bg-sky-500/15 text-sky-500",
              )}
            >
              {toast.tone === "error" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.detail ? <p className="mt-1 text-xs text-[var(--muted)]">{toast.detail}</p> : null}
            </div>
            <button className="grid h-7 w-7 place-items-center rounded-md hover:bg-[var(--hover)]" onClick={() => onDismiss(toast.id)} aria-label="关闭通知">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "确认",
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <section className="animate-dialog-in w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-lift)]">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="h-9 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--hover)] active:scale-[0.98]" onClick={onCancel}>
            取消
          </button>
          <button className="h-9 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:brightness-110 active:scale-[0.98]" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-6 text-center shadow-[var(--shadow-soft)]">
      <div>
        <p className="text-base font-semibold">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function LoadingState({ label = "正在加载..." }: { label?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </main>
  );
}

export function IconButton({
  label,
  children,
  onClick,
  className,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={clsx(
        "grid h-9 w-9 place-items-center rounded-md border border-transparent transition hover:bg-[var(--hover)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, onClick, disabled, "aria-label": ariaLabel }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; "aria-label"?: string }) {
  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-ink)] shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
