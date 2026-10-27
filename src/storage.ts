import { employees } from "./config";
export const EMPLOYEE_KEY = "park-v1-employee";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadEmployee(storage: StoragePort): string {
  try {
    const id = storage.getItem(EMPLOYEE_KEY);
    return employees.some((e) => e.id === id) ? id! : "";
  } catch {
    return "";
  }
}
export const browserStorage: StoragePort = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
