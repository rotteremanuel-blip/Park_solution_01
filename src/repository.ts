import { normalize, type Reservation } from "./domain";
import { backend } from "./backend";

export interface ReservationRepository {
  list(): Promise<Reservation[]>;
  reserve(
    date: string,
    spaceId: string,
    employeeId: string,
  ): Promise<Reservation>;
  cancel(id: string, employeeId: string): Promise<void>;
}

export function createRepository(
  config = backend,
  request: typeof fetch = fetch,
): ReservationRepository {
  async function rpc(name: string, body: object = {}): Promise<unknown> {
    let response: Response;
    try {
      response = await request(`${config.url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error(
        "Supabase ist nicht erreichbar. Bitte prüfe deine Internetverbindung und versuche es erneut.",
      );
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (data?.code === "PGRST202" || data?.code === "42P01")
        throw new Error(
          "Die gemeinsame Datenbank ist noch nicht eingerichtet. Bitte supabase/setup.sql im Supabase SQL Editor ausführen.",
        );
      if (data?.code === "P0001" && typeof data.message === "string")
        throw new Error(data.message);
      if (response.status === 401 || response.status === 403)
        throw new Error(
          "Supabase-Zugriff verweigert. Bitte Projekteinstellungen und Datenbankeinrichtung prüfen.",
        );
      throw new Error(
        "Die Anfrage konnte nicht bestätigt werden. Bitte aktualisiere die Übersicht, bevor du es erneut versuchst.",
      );
    }
    return data;
  }
  function decode(data: unknown): Reservation {
    if (!data || typeof data !== "object")
      throw new Error("Ungültige Antwort der Datenbank.");
    const r = data as Record<string, unknown>;
    const rows = normalize([
      {
        id: r.id,
        date: r.date,
        spaceId: r.space_id,
        employeeId: r.employee_id,
        createdAt: r.created_at,
      },
    ]);
    if (rows.length !== 1) throw new Error("Ungültige Antwort der Datenbank.");
    return rows[0];
  }
  return {
    async list() {
      const result = await rpc("parking_list");
      if (!Array.isArray(result))
        throw new Error("Ungültige Antwort der Datenbank.");
      return result.map(decode);
    },
    async reserve(date, spaceId, employeeId) {
      const result = await rpc("parking_reserve", {
        p_date: date,
        p_space_id: spaceId,
        p_employee_id: employeeId,
      });
      return decode(
        Array.isArray(result) && result.length === 1 ? result[0] : result,
      );
    },
    async cancel(id, employeeId) {
      await rpc("parking_cancel", { p_id: id, p_employee_id: employeeId });
    },
  };
}
export const reservations = createRepository();
