import { employees, spaces } from "./config";
export interface Reservation {
  id: string;
  date: string;
  spaceId: string;
  employeeId: string;
  createdAt: string;
}
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(d: Date, n: number): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(result.getDate() + n);
  return result;
}
export function monday(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(
    ((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7,
  );
}
export function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return dateKey(new Date(`${s}T12:00:00`)) === s;
}
export function editable(date: string, today: Date): boolean {
  if (!validDate(date)) return false;
  const d = new Date(`${date}T12:00:00`);
  return (
    date >= dateKey(today) &&
    date >= dateKey(monday(today)) &&
    date <= dateKey(addDays(monday(today), 18)) &&
    d.getDay() !== 0 &&
    d.getDay() !== 6
  );
}
export function normalize(data: unknown): Reservation[] {
  if (!Array.isArray(data)) return [];
  const result: Reservation[] = [];
  for (const r of data) {
    if (
      !r ||
      typeof r !== "object" ||
      typeof r.id !== "string" ||
      !r.id ||
      !validDate(r.date) ||
      !spaces.some((s) => s === r.spaceId) ||
      !employees.some((e) => e.id === r.employeeId) ||
      typeof r.createdAt !== "string" ||
      !Number.isFinite(Date.parse(r.createdAt))
    )
      continue;
    if (
      result.some(
        (x) =>
          x.id === r.id ||
          (x.date === r.date &&
            (x.spaceId === r.spaceId || x.employeeId === r.employeeId)),
      )
    )
      continue;
    result.push({
      id: r.id,
      date: r.date,
      spaceId: r.spaceId,
      employeeId: r.employeeId,
      createdAt: r.createdAt,
    });
  }
  return result;
}
export function reserve(
  rows: Reservation[],
  date: string,
  spaceId: string,
  employeeId: string,
  today: Date = new Date(),
): Reservation[] {
  if (!editable(date, today))
    throw new Error("Dieser Tag liegt außerhalb des buchbaren Zeitraums.");
  if (!employees.some((e) => e.id === employeeId))
    throw new Error("Bitte wähle zuerst deinen Namen.");
  if (!spaces.some((s) => s === spaceId))
    throw new Error("Unbekannter Parkplatz.");
  if (rows.some((r) => r.date === date && r.spaceId === spaceId))
    throw new Error("Dieser Parkplatz ist bereits reserviert.");
  if (rows.some((r) => r.date === date && r.employeeId === employeeId))
    throw new Error(
      "Du hast für diesen Tag bereits einen Parkplatz reserviert.",
    );
  return [
    ...rows,
    {
      id: crypto.randomUUID(),
      date,
      spaceId,
      employeeId,
      createdAt: new Date().toISOString(),
    },
  ];
}
export function cancel(
  rows: Reservation[],
  id: string,
  employeeId: string,
  today: Date = new Date(),
): Reservation[] {
  const r = rows.find((r) => r.id === id);
  if (!r || r.employeeId !== employeeId)
    throw new Error("Du kannst nur eigene Reservierungen stornieren.");
  if (!editable(r.date, today))
    throw new Error("Dieser Tag kann nicht mehr bearbeitet werden.");
  return rows.filter((r) => r.id !== id);
}
