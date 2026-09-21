import { interpolate, type Dictionary } from "@/lib/i18n";

/**
 * Notifications are stored as a template key plus its parameters, never as
 * rendered prose, so the same row reads in Spanish or English depending on who
 * opens it. `title`/`body` stay in the row as an English fallback for rows
 * written before templates existed.
 */
export type NotificationTemplate = keyof Dictionary["notifications"]["templates"];

export type NotificationParams = Record<string, string>;

export function renderNotification(
  t: Dictionary,
  row: {
    template: string | null;
    params: NotificationParams | null;
    title: string;
    body: string | null;
  },
): { title: string; body: string | null } {
  const templates = t.notifications.templates;
  const template = row.template as NotificationTemplate | null;
  if (!template || !(template in templates)) {
    return { title: row.title, body: row.body };
  }
  const entry = templates[template];
  const params = row.params ?? {};
  return {
    title: interpolate(entry.title, params),
    body: interpolate(entry.body, params),
  };
}
