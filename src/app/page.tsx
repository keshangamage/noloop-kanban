"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { createTask, getTasks, updateTaskStatus } from "@/api/tasks";
import type { Task, TaskStatus } from "@/types";
import styles from "./page.module.css";

const columns: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
];

const MAX_TITLE_LENGTH = 80;

export default function Home() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movingTaskIds, setMovingTaskIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    let ignore = false;

    getTasks()
      .then((result) => {
        if (!ignore) setTasks(result);
      })
      .catch(() => {
        if (!ignore) setLoadError(true);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  function replaceTask(task: Task) {
    setTasks((current) => {
      if (current === null) return current;
      return current.map((item) => item.id === task.id ? task : item);
    });
  }

  async function moveTask(task: Task, status: TaskStatus) {
    if (movingTaskIds.includes(task.id)) return;

    setMoveError(null);
    setMovingTaskIds((current) => [...current, task.id]);
    replaceTask({ ...task, status });

    try {
      const updated = await updateTaskStatus(task.id, status);
      replaceTask(updated);
    } catch {
      replaceTask(task);
      setMoveError(`Couldn’t move “${task.title}”. It’s back in its original column. Try again.`);
    } finally {
      setMovingTaskIds((current) => current.filter((id) => id !== task.id));
    }
  }

  const visibleTasks = tasks?.filter((task) => task.title.toLowerCase().includes(debouncedSearch));

  return (
    <main className={styles.board}>
      <h1>Task Board</h1>
      <div className={styles.boardTools}>
        <div className={styles.search}>
          <label htmlFor="task-search">Search tasks by title</label>
          <input
            id="task-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <AddTaskForm
          disabled={tasks === null}
          onCreated={(task) => setTasks((current) => current && [...current, task])}
        />
      </div>
      {loadError && <p role="alert">Couldn’t load tasks. Refresh the page to try again.</p>}
      {tasks === null && !loadError && <p role="status">Loading tasks…</p>}
      {moveError && <p className={styles.moveError} role="alert">{moveError}</p>}

      <div className={styles.columns}>
        {columns.map(({ status, label }) => {
          const columnTasks = visibleTasks?.filter((task) => task.status === status);
          const headingId = `column-${status.toLowerCase()}`;

          return (
            <section key={status} className={styles.column} aria-labelledby={headingId}>
              <h2 id={headingId}>
                {label}
                {columnTasks && <> <span className={styles.count}>{columnTasks.length}</span></>}
              </h2>
              {columnTasks?.length === 0 && (
                <p className={styles.empty}>{debouncedSearch ? "No matching tasks" : "No tasks"}</p>
              )}
              {columnTasks && columnTasks.length > 0 && (
                <ul className={styles.tasks}>
                  {columnTasks.map((task) => {
                    const isMoving = movingTaskIds.includes(task.id);

                    return (
                      <li key={task.id} className={styles.task}>
                        <h3>{task.title}</h3>
                        {task.description && <p>{task.description}</p>}
                        <div className={styles.actions}>
                          {columns.filter((column) => column.status !== task.status).map((column) => (
                            <button
                              key={column.status}
                              type="button"
                              disabled={isMoving}
                              aria-label={`Move ${task.title} to ${column.label}`}
                              onClick={() => void moveTask(task, column.status)}
                            >
                              Move to {column.label}
                            </button>
                          ))}
                        </div>
                        {isMoving && <p role="status">Moving…</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

type FormFeedback = { kind: "invalid" | "error" | "success"; message: string };

function AddTaskForm({ disabled, onCreated }: { disabled: boolean; onCreated: (task: Task) => void }) {
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const titleInvalid = feedback?.kind === "invalid";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || isCreating) return;

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0 || trimmedTitle.length > MAX_TITLE_LENGTH) {
      const message = trimmedTitle.length === 0
        ? "Enter a task title."
        : `Use ${MAX_TITLE_LENGTH} characters or fewer.`;
      setFeedback({ kind: "invalid", message });
      titleInput.current?.focus();
      return;
    }

    setFeedback(null);
    setIsCreating(true);
    try {
      const task = await createTask({ title: trimmedTitle });
      onCreated(task);
      setTitle("");
      setFeedback({ kind: "success", message: "Task added." });
      titleInput.current?.focus();
    } catch {
      setFeedback({ kind: "error", message: "Couldn’t add the task. Try again." });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form className={styles.addTaskForm} onSubmit={handleSubmit} noValidate aria-busy={isCreating}>
      <label htmlFor="task-title">Task title</label>
      <div className={styles.addTaskControls}>
        <input
          ref={titleInput}
          id="task-title"
          value={title}
          required
          readOnly={isCreating}
          aria-invalid={titleInvalid}
          aria-describedby={titleInvalid ? "task-title-feedback" : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
            setFeedback(null);
          }}
        />
        <button type="submit" disabled={disabled || isCreating}>
          {isCreating ? "Adding…" : "Add task"}
        </button>
      </div>
      {feedback && (
        <p
          id="task-title-feedback"
          className={styles.formFeedback}
          data-kind={feedback.kind}
          role={feedback.kind === "success" ? "status" : "alert"}
        >
          {feedback.message}
        </p>
      )}
    </form>
  );
}
