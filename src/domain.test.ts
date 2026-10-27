import { describe, it, expect } from "vitest";
import {
  addDays,
  cancel,
  dateKey,
  editable,
  isoWeek,
  monday,
  normalize,
  reserve,
} from "./domain";
import {
  BOOKING_KEY,
  EMPLOYEE_KEY,
  loadEmployee,
  loadReservations,
  saveReservations,
  type StoragePort,
} from "./storage";
const today = new Date(2026, 9, 27, 23, 59);
const book = () => reserve([], "2026-10-27", "P1", "emp-01", today);
describe("Reservierungsregeln", () => {
  it("reserviert heute und speichert alle Pflichtfelder", () => {
    expect(book()[0]).toMatchObject({
      date: "2026-10-27",
      spaceId: "P1",
      employeeId: "emp-01",
    });
    expect(book()[0].id).toBeTruthy();
    expect(Date.parse(book()[0].createdAt)).not.toBeNaN();
  });
  it("verhindert doppelte Parkplatzbuchungen", () => {
    expect(() => reserve(book(), "2026-10-27", "P1", "emp-02", today)).toThrow(
      "bereits reserviert",
    );
  });
  it("verhindert einen zweiten Parkplatz pro Person und Tag", () => {
    expect(() => reserve(book(), "2026-10-27", "P2", "emp-01", today)).toThrow(
      "bereits einen Parkplatz",
    );
  });
  it("erlaubt verschiedene Tage und Personen", () => {
    const a = reserve(book(), "2026-10-27", "P2", "emp-02", today);
    expect(reserve(a, "2026-10-28", "P1", "emp-01", today)).toHaveLength(3);
  });
  it("storniert heute und in Zukunft", () => {
    const a = book();
    expect(cancel(a, a[0].id, "emp-01", today)).toEqual([]);
    const b = reserve([], "2026-11-13", "P4", "emp-09", today);
    expect(cancel(b, b[0].id, "emp-09", today)).toEqual([]);
  });
  it("schützt fremde und vergangene Reservierungen", () => {
    const a = book();
    expect(() => cancel(a, a[0].id, "emp-02", today)).toThrow("eigene");
    expect(() => cancel(a, a[0].id, "emp-01", addDays(today, 1))).toThrow(
      "nicht mehr",
    );
    expect(() => reserve([], "2026-10-26", "P1", "emp-01", today)).toThrow();
  });
  it("prüft Zeitraum, Wochenende, Datum, Person und Parkplatz", () => {
    for (const d of ["2026-10-31", "2026-11-14", "2026-11-16", "2026-02-30"])
      expect(() => reserve([], d, "P1", "emp-01", today)).toThrow();
    expect(() => reserve([], "2026-10-27", "P5", "emp-01", today)).toThrow();
    expect(() => reserve([], "2026-10-27", "P1", "invalid", today)).toThrow();
    expect(editable("2026-11-13", today)).toBe(true);
  });
});
describe("Kalender", () => {
  it("berechnet Montag und Grenzen über Jahreswechsel", () => {
    const d = new Date(2027, 0, 1);
    expect(dateKey(monday(d))).toBe("2026-12-28");
    expect(isoWeek(d)).toBe(53);
    expect(isoWeek(new Date(2027, 0, 4))).toBe(1);
    expect(dateKey(addDays(monday(d), 18))).toBe("2027-01-15");
  });
  it("behandelt Sonntag und Sommerzeit als lokale Kalendertage", () => {
    expect(dateKey(monday(new Date(2026, 9, 25)))).toBe("2026-10-19");
    expect(dateKey(addDays(new Date(2026, 2, 28), 2))).toBe("2026-03-30");
  });
});
describe("Persistenz", () => {
  function memory(): StoragePort {
    const values = new Map<string, string>();
    return {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        values.set(k, v);
      },
    };
  }
  it("lädt Buchungen und die letzte Person nach neuem Lesen", () => {
    const s = memory(),
      a = book();
    saveReservations(s, a);
    s.setItem(EMPLOYEE_KEY, "emp-09");
    expect(loadReservations(s)).toEqual(a);
    expect(loadEmployee(s)).toBe("emp-09");
  });
  it("verträgt fehlende, beschädigte und nicht verfügbare Daten", () => {
    const s = memory();
    expect(loadReservations(s)).toEqual([]);
    for (const value of ["{broken", "null", "{}", '[null,2,"x"]']) {
      s.setItem(BOOKING_KEY, value);
      expect(loadReservations(s)).toEqual([]);
    }
    s.setItem(EMPLOYEE_KEY, "unknown");
    expect(loadEmployee(s)).toBe("");
    const broken = {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("blocked");
      },
    };
    expect(loadReservations(broken)).toEqual([]);
    expect(loadEmployee(broken)).toBe("");
    expect(() => saveReservations(broken, book())).toThrow();
  });
  it("filtert ungültige Einträge und beide Konfliktarten", () => {
    const a = book()[0];
    expect(
      normalize([
        a,
        { ...a, id: "duplicate-space", employeeId: "emp-02" },
        { ...a, id: "duplicate-person", spaceId: "P2" },
        { ...a, id: "bad", date: "2026-02-30" },
        null,
      ]),
    ).toEqual([a]);
  });
});
