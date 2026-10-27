import { describe, it, expect } from "vitest";
import {
  addDays,
  dateKey,
  editable,
  isoWeek,
  monday,
  normalize,
} from "./domain";
import { EMPLOYEE_KEY, loadEmployee, type StoragePort } from "./storage";
describe("Kalender", () => {
  it("berechnet Montag und Grenzen über Jahreswechsel", () => {
    const d = new Date(2027, 0, 1);
    expect(dateKey(monday(d))).toBe("2026-12-28");
    expect(isoWeek(d)).toBe(53);
    expect(isoWeek(new Date(2027, 0, 4))).toBe(1);
    expect(dateKey(addDays(monday(d), 18))).toBe("2027-01-15");
  });
  it("begrenzt das lokale Buchungsfenster auf Werktage ab heute", () => {
    const today = new Date(2026, 9, 27, 23, 59);
    expect(editable("2026-10-27", today)).toBe(true);
    expect(editable("2026-11-13", today)).toBe(true);
    for (const date of [
      "2026-10-26",
      "2026-10-31",
      "2026-11-14",
      "2026-11-16",
      "2026-02-30",
    ])
      expect(editable(date, today)).toBe(false);
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
  it("merkt sich ausschließlich den gewählten Namen", () => {
    const s = memory();
    s.setItem(EMPLOYEE_KEY, "emp-09");
    expect(loadEmployee(s)).toBe("emp-09");
    s.setItem(EMPLOYEE_KEY, "unknown");
    expect(loadEmployee(s)).toBe("");
    expect(
      loadEmployee({
        getItem() {
          throw Error("blocked");
        },
        setItem() {},
      }),
    ).toBe("");
  });
  it("filtert ungültige Einträge und beide Konfliktarten", () => {
    const a = {
      id: "test-id",
      date: "2026-10-27",
      spaceId: "P1",
      employeeId: "emp-01",
      createdAt: "2026-10-27T10:00:00Z",
    };
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
