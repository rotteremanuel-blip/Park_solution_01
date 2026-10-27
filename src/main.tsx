import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { employees, spaces } from "./config";
import {
  addDays,
  cancel,
  dateKey,
  editable,
  isoWeek,
  monday,
  reserve,
  type Reservation,
} from "./domain";
import {
  BOOKING_KEY,
  EMPLOYEE_KEY,
  browserStorage,
  loadEmployee,
  loadReservations,
  saveReservations,
} from "./storage";
import "./style.css";
const format = (d: Date) =>
  d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
function App() {
  const [today, setToday] = useState(() => new Date());
  const [offset, setOffset] = useState(0);
  const [employee, setEmployee] = useState(() => loadEmployee(browserStorage));
  const [rows, setRows] = useState(() => loadReservations(browserStorage));
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Reservation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const refresh = () => {
      setToday(new Date());
      setRows(loadReservations(browserStorage));
    };
    const timer = window.setInterval(refresh, 30000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === BOOKING_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);
  const start = addDays(monday(today), offset * 7);
  const days = Array.from({ length: 5 }, (_, i) => addDays(start, i));
  const own = rows.filter(
    (r) =>
      r.employeeId === employee &&
      r.date >= dateKey(today) &&
      r.date <= dateKey(addDays(monday(today), 18)),
  );
  function choose(id: string) {
    setEmployee(id);
    setMessage("");
    try {
      browserStorage.setItem(EMPLOYEE_KEY, id);
    } catch {
      setMessage(
        "Deine Auswahl konnte nicht gespeichert werden. Bitte prüfe die Browsereinstellungen.",
      );
    }
  }
  function commit(
    action: (current: Reservation[]) => Reservation[],
    success: string,
  ) {
    try {
      const next = action(loadReservations(browserStorage));
      saveReservations(browserStorage, next);
      setRows(next);
      setMessage(success);
    } catch (e) {
      setRows(loadReservations(browserStorage));
      setMessage(
        e instanceof Error
          ? e.message
          : "Speichern fehlgeschlagen. Bitte prüfe die Browsereinstellungen.",
      );
    }
  }
  function click(date: string, space: string, r?: Reservation) {
    if (!employee) {
      setMessage("Bitte wähle zuerst deinen Namen oben aus.");
      document.getElementById("employee")?.focus();
      return;
    }
    if (r) {
      if (r.employeeId === employee) setPending(r);
      return;
    }
    commit(
      (current) => reserve(current, date, space, employee, new Date()),
      `${space} am ${format(new Date(date + "T12:00:00"))} ist für dich reserviert.`,
    );
  }
  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            P<span>·</span>
          </span>
          <div>
            Parkplatz<small>DEIN PLATZ. DEINE WOCHE.</small>
          </div>
        </div>
        <span className="poc">
          PoC V1 <span>· Lokal gespeichert</span>
        </span>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">ENTSPANNT ANKOMMEN</div>
            <h1>Ein Platz für deinen Tag.</h1>
            <p>Plane deine Bürotage und sichere dir einen Parkplatz.</p>
          </div>
          <div className="identity">
            <label htmlFor="employee">Ich reserviere als</label>
            <select
              id="employee"
              value={employee}
              onChange={(e) => choose(e.target.value)}
            >
              <option value="" disabled>
                Deinen Namen wählen
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <section className="stats" aria-label="Übersicht">
          <div>
            <span className="stat-icon">P</span>
            <div>
              <strong>
                4 <small>Parkplätze</small>
              </strong>
              <p>Gleichwertig & frei wählbar</p>
            </div>
          </div>
          <div>
            <span className="stat-icon">▦</span>
            <div>
              <strong>
                3 <small>Kalenderwochen</small>
              </strong>
              <p>Heute und zwei Wochen voraus</p>
            </div>
          </div>
          <div>
            <span className="stat-icon blue">✓</span>
            <div>
              <strong>
                {own.length} <small>Meine Reservierungen</small>
              </strong>
              <p>Ab heute im Buchungszeitraum</p>
            </div>
          </div>
        </section>
        <section className="calendar" aria-label="Parkplatzreservierung">
          <div className="calendar-head">
            <div>
              <div className="week-label">
                {offset === 0
                  ? "AKTUELLE WOCHE"
                  : offset === 1
                    ? "NÄCHSTE WOCHE"
                    : "ÜBERNÄCHSTE WOCHE"}
              </div>
              <h2>
                Kalenderwoche {isoWeek(start)}{" "}
                <span>
                  {format(start)} – {format(days[4])}
                </span>
              </h2>
            </div>
            <div className="navigation">
              <button
                aria-label="Vorherige Woche"
                disabled={offset === 0}
                onClick={() => setOffset((n) => n - 1)}
              >
                ←
              </button>
              <button className="today-button" onClick={() => setOffset(0)}>
                Diese Woche
              </button>
              <button
                aria-label="Nächste Woche"
                disabled={offset === 2}
                onClick={() => setOffset((n) => n + 1)}
              >
                →
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Vier Parkplätze, Montag bis Freitag. Freie Plätze anklicken zum
                Reservieren, eigene zum Stornieren.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Parkplatz</th>
                  {days.map((d) => (
                    <th
                      key={dateKey(d)}
                      scope="col"
                      className={
                        dateKey(d) === dateKey(today) ? "current-day" : ""
                      }
                    >
                      <span>
                        {d.toLocaleDateString("de-DE", { weekday: "long" })}
                      </span>
                      <strong>{format(d)}</strong>
                      {dateKey(d) === dateKey(today) && <em>Heute</em>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {spaces.map((space) => (
                  <tr key={space}>
                    <th scope="row">
                      <span className="space-icon">P</span>
                      {space}
                    </th>
                    {days.map((d) => {
                      const date = dateKey(d),
                        r = rows.find(
                          (r) => r.date === date && r.spaceId === space,
                        ),
                        past = !editable(date, today),
                        mine = r?.employeeId === employee;
                      return (
                        <td key={date}>
                          <button
                            className={`slot ${past ? "past" : r ? (mine ? "mine" : "occupied") : "free"}`}
                            disabled={past || !!(r && !mine)}
                            onClick={() => click(date, space, r)}
                            aria-label={`${space}, ${format(d)}: ${r ? employees.find((e) => e.id === r.employeeId)?.name : "Frei"}${mine && !past ? ", zum Stornieren anklicken" : ""}`}
                          >
                            <span className="slot-symbol" aria-hidden="true">
                              {past ? "–" : r ? (mine ? "✓" : "●") : "+"}
                            </span>
                            <span>
                              {r
                                ? employees.find((e) => e.id === r.employeeId)
                                    ?.name
                                : "Frei"}
                              <small>
                                {past
                                  ? "Vergangen"
                                  : r
                                    ? mine
                                      ? "Dein Parkplatz"
                                      : "Reserviert"
                                    : "Reservieren"}
                              </small>
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="calendar-footer">
            <div className="legend">
              <span>
                <i className="green-dot" />
                Frei
              </span>
              <span>
                <i className="blue-dot" />
                Deine Reservierung
              </span>
              <span>
                <i className="gray-dot" />
                Reserviert
              </span>
            </div>
            <span>Ein Parkplatz pro Person & Tag</span>
          </div>
        </section>
        <p className="feedback" role="status" aria-live="polite">
          {message ||
            (!employee
              ? "Wähle deinen Namen, um einen freien Parkplatz zu reservieren."
              : "Klicke auf einen freien Platz zum Reservieren oder auf deinen Platz zum Stornieren.")}
        </p>
        <aside className="notice">
          <span aria-hidden="true">ⓘ</span>
          <div>
            <strong>Dein lokaler Testbereich</strong>
            <p>
              Reservierungen werden nur in diesem Browser gespeichert und nicht
              mit anderen Geräten geteilt. Die Namensauswahl ist keine
              Anmeldung. Eine verbindliche Vergabe über mehrere Geräte ist in
              diesem PoC nicht möglich.
            </p>
          </div>
        </aside>
        <footer>
          Parkplatz <span>Weniger suchen. Entspannter ankommen.</span>
          <span>9 Kolleginnen & Kollegen · 4 Parkplätze</span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        onCancel={() => setPending(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPending(null);
        }}
        aria-labelledby="cancel-title"
      >
        <h2 id="cancel-title">Reservierung stornieren?</h2>
        <p>
          {pending &&
            `${pending.spaceId} am ${format(new Date(pending.date + "T12:00:00"))} wird wieder für alle frei.`}
        </p>
        <div className="dialog-actions">
          <button onClick={() => setPending(null)}>Behalten</button>
          <button
            className="primary"
            onClick={() => {
              if (pending)
                commit(
                  (current) =>
                    cancel(current, pending.id, employee, new Date()),
                  "Deine Reservierung wurde storniert.",
                );
              setPending(null);
            }}
          >
            Stornieren
          </button>
        </div>
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
