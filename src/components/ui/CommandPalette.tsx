"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CornerDownLeft,
  GraduationCap,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import { cn, toDayKey } from "@/lib/utils";
import { useTodosStore } from "@/lib/store/todos";
import { useT } from "@/lib/i18n";
import { useHomeworkStore } from "@/lib/store/homework";
import { useEventsStore } from "@/lib/store/events";
import { useSubjectsStore } from "@/lib/store/subjects";
import { parseQuickEntry } from "@/lib/quickCapture";
import { syncNow } from "@/lib/auth/sync";

/**
 * ⌘K / Ctrl+K command palette — the universal quick-add: jump to any page,
 * or type one line ("Mathe Blatt 14 bis Fr") and it becomes a task, homework
 * or exam with subject and due date parsed out of the text. Also toggles the
 * theme and forces a sync. The overlay body is a separate mount, so its
 * input state is fresh on open.
 */

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

const PAGES_SRC: Array<{ href: Route; label: string }> = [
  { href: "/", label: "Overview" },
  { href: "/todos", label: "Tasks" },
  { href: "/homework", label: "Homework" },
  { href: "/grades", label: "Grades" },
  { href: "/timetable", label: "Timetable" },
  { href: "/calendar", label: "Calendar" },
  { href: "/read", label: "Reading" },
  { href: "/study-room", label: "Study Room" },
  { href: "/account", label: "Account" },
];

const PageIcon = ArrowRight;

function PaletteOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const subjects = useSubjectsStore((s) => s.subjects);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  // the overlay remounts on open, so this is the live theme at open time
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  const commands = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase();
    // one line in, structured entry out: subject + due date parsed from the text
    const parsed = q.length > 0 ? parseQuickEntry(query, subjects) : null;
    const parsedHint =
      parsed && parsed.match.length > 0 ? parsed.match.join(" · ") : undefined;
    const pageCmds: Command[] = PAGES_SRC.filter((p) => !q || t(p.label).toLowerCase().includes(q)).map(
      (p) => ({
        id: `page-${p.href}`,
        label: t(p.label),
        hint: t("go to"),
        icon: PageIcon,
        run: () => {
          router.push(p.href);
          onClose();
        },
      }),
    );
    const createCmds: Command[] =
      q.length > 0
        ? [
            {
              id: "create-task",
              label: `${t("New task:")} "${parsed?.title || query.trim()}"`,
              hint: parsedHint ?? "Enter",
              icon: Plus,
              run: () => {
                useTodosStore.getState().addTodo({
                  title: parsed?.title || query.trim(),
                  priority: "medium",
                  due: parsed?.due,
                  subjectId: parsed?.subjectId,
                });
                router.push("/todos");
                onClose();
              },
            },
            {
              id: "create-homework",
              label: `${t("New homework:")} "${parsed?.title || query.trim()}"`,
              hint: parsedHint ?? "Enter",
              icon: BookOpen,
              run: () => {
                useHomeworkStore.getState().addHomework({
                  title: parsed?.title || query.trim(),
                  priority: "medium",
                  due: parsed?.due,
                  subjectId: parsed?.subjectId,
                });
                router.push("/homework");
                onClose();
              },
            },
            {
              id: "create-exam",
              label: `${t("New exam (SA):")} "${parsed?.title || query.trim()}"`,
              hint: parsed?.match[0] ?? t("today"),
              icon: GraduationCap,
              run: () => {
                // quick capture: dated from the text (else today), refine on the calendar
                useEventsStore.getState().addEvent({
                  title: parsed?.title || query.trim(),
                  date: parsed?.due?.slice(0, 10) ?? toDayKey(new Date()),
                  type: "exam",
                  subjectId: parsed?.subjectId,
                });
                router.push("/calendar");
                onClose();
              },
            },
          ]
        : [];
    const actions: Command[] = [
      {
        id: "toggle-theme",
        label: dark ? t("Switch to light mode") : t("Switch to dark mode"),
        hint: t("theme"),
        icon: dark ? Sun : Moon,
        run: () => {
          const next = !dark;
          document.documentElement.classList.toggle("dark", next);
          try {
            localStorage.setItem("semester.theme", next ? "dark" : "light");
          } catch {}
          setDark(next);
        },
      },
      {
        id: "sync-now",
        label: t("Sync now"),
        hint: t("sync"),
        icon: RefreshCw,
        run: () => {
          void syncNow();
          onClose();
        },
      },
    ];
    // actions stay findable by their hint word ("theme", "sync")
    const matches = (c: { label: string; hint?: string }) =>
      !q || c.label.toLowerCase().includes(q) || c.hint?.includes(q);
    return [...pageCmds.filter(matches), ...createCmds, ...actions.filter(matches)];
  }, [query, router, onClose, dark, t, subjects]);

  // clamped in render — no effect needed to keep the selection in range
  const sel = Math.min(selected, Math.max(0, commands.length - 1));

  const runSelected = () => commands[sel]?.run();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="size-4 shrink-0 text-ink-soft" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected(Math.min(sel + 1, commands.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected(Math.max(sel - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runSelected();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder={t("Jump somewhere, or type a task, homework or exam")}
            aria-label="Command palette input"
            className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft/60"
          />
          <kbd className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
            esc
          </kbd>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {commands.length === 0 && (
            <li className="px-3 py-6 text-center text-sm italic text-ink-soft">{t("Nothing matches.")}</li>
          )}
          {commands.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                onClick={cmd.run}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  i === sel ? "bg-accent-soft text-accent" : "text-ink hover:bg-ink/5",
                )}
              >
                <cmd.icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{cmd.label}</span>
                {cmd.hint && (
                  <span className="shrink-0 font-mono text-[10px] text-ink-soft uppercase">
                    {cmd.hint}
                  </span>
                )}
                {i === sel && <CornerDownLeft className="size-3.5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10px] text-ink-soft">
          <span>{t("Enter to run")}</span>
          <span>{t("↑↓ to choose")}</span>
        </div>
      </div>
    </div>
  );
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return <PaletteOverlay onClose={() => setOpen(false)} />;
}
