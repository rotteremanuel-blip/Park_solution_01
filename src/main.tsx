import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { employees, spaces } from "./config";
import {
  addDays,
  dateKey,
  editable,
  isoWeek,
  monday,
  type Reservation,
} from "./domain";
import { EMPLOYEE_KEY, browserStorage, loadEmployee } from "./storage";
import { reservations } from "./repository";
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
  const [rows, setRows] = useState<Reservation[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const operation = useRef(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Reservation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setToday(new Date());
    try {
      const current = await reservations.list();
      setRows(current);
      setReady(true);
      setConnectionError("");
    } catch (error) {
      setReady(false);
      setConnectionError(
        error instanceof Error ? error.message : "Laden fehlgeschlagen.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [refresh]);
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
  async function commit(action: () => Promise<void>, success: string) {
    if (operation.current || !ready) return;
    operation.current = true;
    setBusy(true);
    try {
      await action();
      setMessage(success);
      setConnectionError("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Speichern fehlgeschlagen.",
      );
    }
    // Auch nach Konflikten erneut lesen. Kein Zurückfallen auf Browser-Buchungen.
    try {
      setRows(await reservations.list());
      setReady(true);
    } catch (error) {
      setReady(false);
      setConnectionError(
        error instanceof Error
          ? error.message
          : "Aktualisieren fehlgeschlagen.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
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
      async () => {
        const created = await reservations.reserve(date, space, employee);
        setRows((current) => [
          ...current.filter((r) => r.id !== created.id),
          created,
        ]);
      },
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
          Team-PoC <span>· Gemeinsam gespeichert</span>
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
              disabled={busy}
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
          <div className="sync-bar">
            <span role="status">
              {connectionError
                ? "Verbindung unterbrochen – Buchungen gesperrt"
                : !ready
                  ? "Reservierungen werden geladen …"
                  : busy
                    ? "Wird aktualisiert …"
                    : "Gemeinsamer Stand · automatische Aktualisierung alle 30 Sekunden"}
            </span>
            <button onClick={() => void refresh()} disabled={busy}>
              Aktualisieren
            </button>
          </div>
          {connectionError && (
            <p className="connection-error" role="alert">
              {connectionError}{" "}
              {rows.length > 0 &&
                "Die angezeigten Buchungen können veraltet sein."}
            </p>
          )}
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
                            className={`slot ${!ready ? "unavailable" : past ? "past" : r ? (mine ? "mine" : "occupied") : "free"}`}
                            disabled={!ready || busy || past || !!(r && !mine)}
                            onClick={() => click(date, space, r)}
                            aria-label={`${space}, ${format(d)}: ${r ? employees.find((e) => e.id === r.employeeId)?.name : !ready ? "Nicht geladen" : "Frei"}${mine && !past ? ", zum Stornieren anklicken" : ""}`}
                          >
                            <span className="slot-symbol" aria-hidden="true">
                              {past ? "–" : r ? (mine ? "✓" : "●") : "+"}
                            </span>
                            <span>
                              {!ready && !r
                                ? "–"
                                : r
                                  ? employees.find((e) => e.id === r.employeeId)
                                      ?.name
                                  : "Frei"}
                              <small>
                                {!ready && !r
                                  ? "Nicht geladen"
                                  : past
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
            <strong>Gemeinsam planen</strong>
            <p>
              Reservierungen werden zentral gespeichert und sind auf allen
              Geräten sichtbar. Änderungen anderer Personen erscheinen
              spätestens nach 30 Sekunden oder über „Aktualisieren“. Die
              Namensauswahl ist keine Anmeldung: Wer den Link kennt, kann jeden
              Namen auswählen. Bisherige lokale Testbuchungen werden nicht
              übernommen.
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
            disabled={busy || !ready}
            onClick={() => {
              if (pending)
                commit(async () => {
                  await reservations.cancel(pending.id, employee);
                  setRows((current) =>
                    current.filter((r) => r.id !== pending.id),
                  );
                }, "Deine Reservierung wurde storniert.");
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
