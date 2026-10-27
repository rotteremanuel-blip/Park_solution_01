import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
const sql = readFileSync(
  new URL("../supabase/setup.sql", import.meta.url),
  "utf8",
);
let db: PGlite;
let day: string;
async function reserve(space = "P1", employee = "emp-01", date = day) {
  return db.query<{ id: string }>(
    "select * from public.parking_reserve($1::date,$2,$3)",
    [date, space, employee],
  );
}
describe("PostgreSQL-Regeln und öffentliche Rechte", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create role anon; create role authenticated;");
    await db.exec(sql);
    const result = await db.query<{ date: string }>(
      `select to_char(d, 'YYYY-MM-DD') as date from generate_series((now() at time zone 'Europe/Vienna')::date, (now() at time zone 'Europe/Vienna')::date+6, interval '1 day') d where extract(isodow from d) between 1 and 5 order by d limit 1`,
    );
    day = result.rows[0].date;
  }, 30000);
  beforeEach(async () => {
    await db.exec("reset role; truncate public.parking_reservations;");
  });
  afterAll(async () => {
    await db.close();
  });
  it("kann wiederholt eingerichtet werden, ohne Buchungen zu löschen", async () => {
    await reserve();
    await db.exec(sql);
    expect(
      (await db.query("select * from public.parking_list()")).rows,
    ).toHaveLength(1);
  });
  it("weist Doppelbelegung und zweite Tagesbuchung atomar zurück", async () => {
    await reserve();
    await expect(reserve("P1", "emp-02")).rejects.toThrow("bereits reserviert");
    await expect(reserve("P2", "emp-01")).rejects.toThrow(
      "bereits einen Parkplatz",
    );
    expect(
      (await db.query("select * from public.parking_list()")).rows,
    ).toHaveLength(1);
  });
  it("entscheidet auch bei konkurrierenden Anfragen genau einmal", async () => {
    const results = await Promise.allSettled([
      reserve("P1", "emp-01"),
      reserve("P1", "emp-02"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("prüft Tage, Namen und Plätze unabhängig vom Browser", async () => {
    for (const d of ["2000-01-03", "2099-01-01"])
      await expect(reserve("P1", "emp-01", d)).rejects.toThrow("Zeitraums");
    const weekend = await db.query<{ date: string }>(
      `select to_char(date_trunc('week', now() at time zone 'Europe/Vienna')+interval '12 days','YYYY-MM-DD') as date`,
    );
    await expect(reserve("P1", "emp-01", weekend.rows[0].date)).rejects.toThrow(
      "Zeitraums",
    );
    await expect(reserve("P5")).rejects.toThrow("Unbekannter");
    await expect(reserve("P1", "emp-10")).rejects.toThrow("gültigen Namen");
  });
  it("erlaubt fremde Namen nicht direkt zu stornieren", async () => {
    const r = await reserve();
    await expect(
      db.query("select public.parking_cancel($1,$2)", [r.rows[0].id, "emp-02"]),
    ).rejects.toThrow("Stornieren nicht möglich");
    await db.query("select public.parking_cancel($1,$2)", [
      r.rows[0].id,
      "emp-01",
    ]);
    expect(
      (await db.query("select * from public.parking_list()")).rows,
    ).toHaveLength(0);
  });
  it("schützt historische Buchungen auch bei direkten API-Aufrufen", async () => {
    const r = await db.query<{ id: string }>(
      `insert into public.parking_reservations(date,space_id,employee_id) values ('2000-01-03','P1','emp-01') returning id`,
    );
    await expect(
      db.query("select public.parking_cancel($1,$2)", [r.rows[0].id, "emp-01"]),
    ).rejects.toThrow("Stornieren nicht möglich");
  });
  it("gibt anonymen Clients nur Funktionen frei, keinen direkten Tabellenzugriff", async () => {
    await db.exec("set role anon;");
    try {
      await expect(
        db.query("select * from public.parking_reservations"),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query(
          `insert into public.parking_reservations(date,space_id,employee_id) values ($1,'P1','emp-01')`,
          [day],
        ),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("delete from public.parking_reservations"),
      ).rejects.toThrow("permission denied");
      await reserve();
      expect(
        (await db.query("select * from public.parking_list()")).rows,
      ).toHaveLength(1);
    } finally {
      await db.exec("reset role;");
    }
  });
});
