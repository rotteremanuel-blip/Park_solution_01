import { describe, it, expect, vi } from "vitest";
import { createRepository } from "./repository";
const row = {
  id: "a",
  date: "2026-10-27",
  space_id: "P1",
  employee_id: "emp-01",
  created_at: "2026-10-27T10:00:00Z",
};
const config = {
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_test",
};
function fixture(data: unknown, status = 200) {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(data), { status }));
  return { request, repo: createRepository(config, request) };
}
describe("Supabase-Schnittstelle", () => {
  it("akzeptiert die einzeilige Tabellenantwort von PostgREST", async () => {
    const { repo } = fixture([row]);
    expect((await repo.reserve(row.date, "P1", "emp-01")).id).toBe("a");
  });
  it("liest zentrale Buchungen und übersetzt die Daten", async () => {
    const { repo, request } = fixture([row]);
    expect(await repo.list()).toEqual([
      {
        id: "a",
        date: row.date,
        spaceId: "P1",
        employeeId: "emp-01",
        createdAt: row.created_at,
      },
    ]);
    expect(request).toHaveBeenCalledWith(
      config.url + "/rest/v1/rpc/parking_list",
      expect.objectContaining({
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          "Content-Type": "application/json",
        },
      }),
    );
  });
  it("sendet Buchung ohne clientseitig erfundene ID oder Zeit", async () => {
    const { repo, request } = fixture(row);
    await repo.reserve(row.date, "P1", "emp-01");
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({
      p_date: row.date,
      p_space_id: "P1",
      p_employee_id: "emp-01",
    });
  });
  it("storniert eine einzelne Buchung mit Mitarbeiter-ID", async () => {
    const { repo, request } = fixture(null);
    await repo.cancel("a", "emp-01");
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({
      p_id: "a",
      p_employee_id: "emp-01",
    });
  });
  it("zeigt serverseitige Buchungskonflikte", async () => {
    const { repo } = fixture(
      { code: "P0001", message: "Dieser Parkplatz ist bereits reserviert." },
      400,
    );
    await expect(repo.reserve(row.date, "P1", "emp-02")).rejects.toThrow(
      "bereits reserviert",
    );
  });
  it("unterscheidet fehlende Einrichtung und verweigerten Zugriff", async () => {
    await expect(
      fixture({ code: "PGRST202" }, 404).repo.list(),
    ).rejects.toThrow("SQL Editor");
    await expect(fixture({}, 403).repo.list()).rejects.toThrow(
      "Zugriff verweigert",
    );
  });
  it("meldet Verbindungsfehler statt lokaler Ersatzdaten", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("offline"));
    await expect(createRepository(config, request).list()).rejects.toThrow(
      "nicht erreichbar",
    );
  });
  it("verhindert falsche Erfolgsmeldungen bei fehlerhafter Antwort", async () => {
    await expect(fixture({}).repo.list()).rejects.toThrow("Ungültige Antwort");
    await expect(
      fixture([{ ...row, employee_id: "unknown" }]).repo.list(),
    ).rejects.toThrow("Ungültige Antwort");
    await expect(
      fixture({}, 500).repo.reserve(row.date, "P1", "emp-01"),
    ).rejects.toThrow("nicht bestätigt");
  });
});
