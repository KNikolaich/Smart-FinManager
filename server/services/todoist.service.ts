import { ReplitConnectors } from "@replit/connectors-sdk";
import type { ProxyOptions } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

async function todoistRequest(path: string, options?: ProxyOptions) {
  const response = await connectors.proxy("todoist", path, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(`Todoist request failed with ${response.status}`);
    (error as Error & { status?: number; body?: string }).status = response.status;
    (error as Error & { status?: number; body?: string }).body = body;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function listTodoistTasks() {
  const results: unknown[] = [];
  let cursor = "";

  // Todoist returns at most 100 tasks per response. Keep following its
  // cursor so an older workspace does not silently lose reminders.
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const response = await todoistRequest(`/api/v1/tasks?${params.toString()}`) as {
      results?: unknown[];
      next_cursor?: string | null;
    };
    if (Array.isArray(response?.results)) results.push(...response.results);
    cursor = response?.next_cursor || "";
    if (!cursor) break;
  }

  return { results, next_cursor: cursor || null };
}

export function createTodoistTask(input: {
  content: string;
  dueString: string;
}) {
  return todoistRequest("/api/v1/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: input.content,
      due_string: input.dueString,
    }),
  });
}

export function updateTodoistTask(id: string, input: {
  content: string;
  dueString: string;
}) {
  return todoistRequest(`/api/v1/tasks/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: input.content,
      due_string: input.dueString,
    }),
  });
}