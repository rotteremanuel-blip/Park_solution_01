import { normalize, type Reservation } from "./domain";
import { employees } from "./config";
export const BOOKING_KEY = "park-v1-reservations";
export const EMPLOYEE_KEY = "park-v1-employee";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadReservations(storage: StoragePort): Reservation[] {
  try {
    return normalize(JSON.parse(storage.getItem(BOOKING_KEY) ?? "[]"));
  } catch {
    return [];
  }
}
export function loadEmployee(storage: StoragePort): string {
  try {
    const id = storage.getItem(EMPLOYEE_KEY);
    return employees.some((e) => e.id === id) ? id! : "";
  } catch {
    return "";
  }
}
export function saveReservations(
  storage: StoragePort,
  rows: Reservation[],
): void {
  storage.setItem(BOOKING_KEY, JSON.stringify(rows));
}
export const browserStorage: StoragePort = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
