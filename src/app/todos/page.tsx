"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { useTodosStore } from "@/lib/store/todos";
import { useSubjectsStore } from "@/lib/store/subjects";
import { useHydrated } from "@/lib/hooks";
import type { Todo } from "@/lib/types";
import { cn, dueInfo, findSubject, PRIORITY_ORDER } from "@/lib/utils";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { DueChip, EmptyState, PriorityBadge, SubjectTag } from "@/components/ui/bits";
import TodoFormModal from "@/components/todos/TodoFormModal";

type StatusFilter = "open" | "done" | "all";

interface TaskGroup {
  key: string;
  label: string;
  tone: "marker" | "accent" | "plain";
  todos: Todo[];
}

/** open tasks bucketed by urgency — the pile reads itself top-down */
function groupOpen(todos: Todo[]): TaskGroup[] {
  const tomorrowMs = new Date(new Date().toDateString()).getTime() + 2 * 86_400_000;
  const weekMs = tomorrowMs + 6 * 86_400_000;

  const buckets: Record<string, Todo[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    later: [],
    someday: [],
  };
  for (const t of todos) {
    const info = dueInfo(t.due);
    if (!info) buckets.someday.push(t);
    else if (info.date.getTime() < tomorrowMs - 86_400_000) buckets.overdue.push(t);
    else if (info.isToday) buckets.today.push(t);
    else if (info.date.getTime() < tomorrowMs) buckets.tomorrow.push(t);
    else if (info.date.getTime() <= weekMs) buckets.week.push(t);
    else buckets.later.push(t);
  }
  const byDue = (a: Todo, b: Todo) => {
    const da = dueInfo(a.due)?.date?.getTime() ?? Infinity;
    const db = dueInfo(b.due)?.date?.getTime() ?? Infinity;
    if (da !== db) return da - db;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  };

  const meta: Array<[string, string, TaskGroup["tone"]]> = [
    ["overdue", "Overdue", "marker"],
    ["today", "Today", "accent"],
    ["tomorrow", "Tomorrow", "plain"],
    ["week", "This week", "plain"],
    ["later", "Later", "plain"],
    ["someday", "Someday", "plain"],
  ];
  return meta
    .map(([key, label, tone]) => ({
      key,
      label,
      tone,
      todos: buckets[key].sort(byDue),
    }))
    .filter((g) => g.todos.length > 0);
}

export default function TodosPage() {
  const hydrated = useHydrated();
  const todos = useTodosStore((s) => s.todos);
  const addTodo = useTodosStore((s) => s.addTodo);
  const subjects = useSubjectsStore((s) => s.subjects);
  const toggleTodo = useTodosStore((s) => s.toggleTodo);
  const removeTodo = useTodosStore((s) => s.removeTodo);

  const [status, setStatus] = useState<StatusFilter>("open");
  const [subjectFilter, setSubjectFilter] = useState<string | "all">("all");
  const [modal, setModal] = useState<{ open: boolean; todo?: Todo }>({ open: false });

  // quick add: a title and an optional due date, Enter commits
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDue, setQuickDue] = useState("");

  const filtered = useMemo(() => {
    let list = todos;
    if (status !== "all") list = list.filter((t) => (status === "done" ? t.done : !t.done));
    if (subjectFilter !== "all") list = list.filter((t) => t.subjectId === subjectFilter);
    return list;
  }, [todos, status, subjectFilter]);

  const groups = useMemo(
    () => (status === "open" ? groupOpen(filtered) : []),
    [status, filtered],
  );
  // done / all views stay one flat, newest-relevant-first list
  const flat = useMemo(() => {
    if (status === "open") return [];
    return [...filtered].sort((a, b) => {
      const da = dueInfo(a.due)?.date?.getTime() ?? Infinity;
      const db = dueInfo(b.due)?.date?.getTime() ?? Infinity;
      if (da !== db) return da - db;
      return b.createdAt - a.createdAt;
    });
  }, [status, filtered]);

  const openCount = todos.filter((t) => !t.done).length;

  const addQuick = () => {
    const title = quickTitle.trim();
    if (!title) return;
    addTodo({
      title,
      priority: "medium",
      due: quickDue || undefined,
    });
    setQuickTitle("");
    setQuickDue("");
  };

  if (!hydrated) return <PageSkeleton />;

  const row = (todo: Todo) => {
    const subject = findSubject(subjects, todo.subjectId);
    const info = dueInfo(todo.due);
    return (
      <li
        key={todo.id}
        className="group flex items-start gap-3 px-3 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-paper-deep/50"
      >
        <button
          onClick={() => toggleTodo(todo.id)}
          aria-label={todo.done ? "Mark as open" : "Mark as done"}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors",
            todo.done
              ? "border-accent bg-accent text-paper"
              : "border-ink/30 hover:border-accent hover:bg-accent/10",
          )}
        >
          {todo.done && <Check className="size-3" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm leading-snug font-medium",
              todo.done && "text-ink-soft line-through",
            )}
          >
            {todo.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {subject && <SubjectTag name={subject.name} color={subject.color} />}
            {info && <DueChip due={todo.due} done={todo.done} />}
            <PriorityBadge priority={todo.priority} />
          </div>
          {todo.notes && (
            <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">{todo.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
          <button
            className="btn-icon"
            aria-label="Edit task"
            onClick={() => setModal({ open: true, todo })}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            className="btn-icon hover:text-marker"
            aria-label="Delete task"
            onClick={() => removeTodo(todo.id)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div>
      <header className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 font-mono text-xs tracking-wide text-ink-soft">
            {openCount} open · {todos.length - openCount} done
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ open: true })}>
          <Plus className="size-4" /> New task
        </button>
      </header>

      {/* quick add — title, optional due date, Enter */}
      <div className="rise card mb-6 flex flex-wrap items-center gap-2 px-4 py-2.5">
        <span
          className="grid size-5 shrink-0 place-items-center rounded-full border border-dashed border-ink/30 text-ink-soft"
          aria-hidden
        >
          +
        </span>
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addQuick()}
          placeholder="Add a task and press Enter"
          aria-label="Quick-add a task"
          className="min-w-40 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60"
        />
        <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-ink-soft">
          <CalendarDays className="size-3.5" />
          <input
            type="date"
            value={quickDue}
            onChange={(e) => setQuickDue(e.target.value)}
            aria-label="Due date for the quick-added task"
            className="cursor-pointer bg-transparent font-mono text-[11px] text-ink outline-none"
          />
        </label>
      </div>

      {/* filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-line bg-card p-0.5">
          {(["open", "done", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-colors",
                status === s ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubjectFilter("all")}
            className={cn(
              "chip cursor-pointer px-2.5 py-1 transition-colors",
              subjectFilter === "all" ? "border-ink bg-ink text-paper" : "hover:border-ink/30",
            )}
          >
            All subjects
          </button>
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubjectFilter(subjectFilter === s.id ? "all" : s.id)}
              className={cn(
                "chip cursor-pointer px-2.5 py-1 transition-colors",
                subjectFilter === s.id ? "border-ink bg-ink text-paper" : "hover:border-ink/30",
              )}
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* list — open tasks read top-down by urgency, done/all stay flat */}
      {status === "open" ? (
        groups.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-8" />}
            title="No tasks here"
            hint="Add a task with a due date, priority and subject. It will also show up on the calendar."
            action={
              <button className="btn-primary" onClick={() => setModal({ open: true })}>
                <Plus className="size-4" /> New task
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.key}>
                <h2
                  className={cn(
                    "mb-2 font-mono text-[10px] tracking-[0.14em] uppercase",
                    g.tone === "marker" && "font-semibold text-marker",
                    g.tone === "accent" && "font-semibold text-accent",
                    g.tone === "plain" && "text-ink-soft",
                  )}
                >
                  {g.label}
                  <span className="ml-1.5 font-normal">{g.todos.length}</span>
                </h2>
                <ul className="card divide-y divide-line px-2">{g.todos.map(row)}</ul>
              </section>
            ))}
          </div>
        )
      ) : flat.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-8" />}
          title={status === "done" ? "Nothing completed yet" : "No tasks here"}
          hint={
            status === "done"
              ? "Finished tasks will collect here."
              : "Add a task with a due date, priority and subject. It will also show up on the calendar."
          }
          action={
            <button className="btn-primary" onClick={() => setModal({ open: true })}>
              <Plus className="size-4" /> New task
            </button>
          }
        />
      ) : (
        <ul className="card divide-y divide-line px-2">{flat.map(row)}</ul>
      )}

      <TodoFormModal
        open={modal.open}
        todo={modal.todo}
        onClose={() => setModal({ open: false })}
      />
    </div>
  );
}
