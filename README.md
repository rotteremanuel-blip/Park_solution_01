# Parkplatz – gemeinsamer Team-PoC

Responsive Reservierung für Simone, Markus, Benjamin, Andreas, Amir, Thomas, Nicolas, Philipp und Emanuel, vier gleichwertige Plätze und drei Kalenderwochen. React, TypeScript, Vite, Tailwind CSS; statisches Hosting auf GitHub Pages, gemeinsame Datenbank bei Supabase.

## Supabase einmalig einrichten

1. Im Supabase-Projekt den **SQL Editor** öffnen und **New query** wählen.
2. Den vollständigen Inhalt von [`supabase/setup.sql`](supabase/setup.sql) einfügen und **Run** klicken. Das Skript ist wiederholbar und löscht keine vorhandenen Buchungen.
3. Unter **Actions → Deploy GitHub Pages** im GitHub-Repository auf einen grünen Lauf warten; bei Bedarf **Run workflow** auf `main` starten.
4. https://rotteremanuel-blip.github.io/Park_solution_01/ öffnen bzw. mit Strg+F5 neu laden.
5. In zwei getrennten Browsern unterschiedliche Namen wählen. In einem Browser buchen, im zweiten **Aktualisieren** klicken: Beide müssen dieselbe Buchung sehen. Danach die Testbuchung wieder stornieren.

Die Project URL und der absichtlich öffentliche Publishable Key stehen in `src/backend.ts`. **Niemals einen Secret Key, service_role Key oder das Datenbankpasswort dort eintragen.** `supabase/setup.sql` sperrt direkten Tabellenzugriff für anonyme Browser. Nur die drei begrenzten Funktionen `parking_list`, `parking_reserve` und `parking_cancel` sind freigegeben.

Ohne ausgeführtes SQL zeigt die App einen Einrichtungsfehler und sperrt Buchungen. Bei Verbindungsfehlern bleibt der letzte geladene Stand sichtbar, wird als veraltet gekennzeichnet und kann nicht bearbeitet werden. Es gibt keinen lokalen Ersatzmodus.

## Lokal entwickeln und prüfen

Node.js 22.12 oder neuer und npm:

```sh
npm install
npm run dev
```

Mit vorhandener Lockdatei reproduzierbar installieren: `npm ci`. Auch lokal benutzt die App das konfigurierte Supabase-Projekt; manuelle Buchungen dort sind echte gemeinsame Buchungen.

```sh
npm test          # Kalender-, API- und PostgreSQL-Regeltests
npm run build    # TypeScript-Prüfung und Production-Build in dist/
npm run preview  # Gebauten Stand lokal prüfen
```

Die Datenbanktests verwenden PostgreSQL in PGlite als reine Entwicklungsabhängigkeit, keine echte Supabase-Verbindung und keine Produktivdaten. Sie führen das tatsächliche Einrichtungsskript aus und prüfen Eindeutigkeitsbedingungen, Buchungsfenster, Stornierung und anonyme Datenbankrechte. API-Tests prüfen Anfragen und Fehlerbehandlung mit simulierten HTTP-Antworten. Ein echter Zwei-Geräte-Test nach Datenbankeinrichtung bleibt erforderlich.

## Aufbau und Namen ändern

- `src/config.ts`: neun Namen mit stabilen IDs sowie P1 bis P4. Beim Umbenennen IDs beibehalten.
- `src/domain.ts`: lokale Kalenderberechnung, Datenmodell und Validierung.
- `src/repository.ts`: asynchrone Supabase-REST-Schnittstelle ohne zusätzliche Browserbibliothek.
- `src/backend.ts`: öffentliche Verbindungskonfiguration.
- `src/storage.ts`: nur die letzte Namensauswahl im localStorage.
- `supabase/setup.sql`: Tabelle, Unique Constraints, RLS und freigegebene Funktionen.
- `src/main.tsx`: Oberfläche, Ladezustand, Fehler, Aktualisierung und Stornodialog.

Neue Mitarbeiter oder Plätze erfordern zusätzlich eine entsprechende Änderung der Prüfungen im SQL-Skript. Die relative Vite-Basis unterstützt den GitHub-Pages-Unterpfad.

## Verhalten und Grenzen

Buchungen liegen zentral in Supabase, nicht mehr im Browser. Bestehende lokale V1-Testbuchungen werden bewusst nicht importiert, weil unterschiedliche Browser widersprüchliche Buchungen enthalten können; sie bleiben ungenutzt im alten Browser-Speicher. Nur die Namensauswahl bleibt lokal gespeichert.

Andere Geräte sehen Änderungen beim Neuladen, beim Fensterfokus, über **Aktualisieren** oder spätestens nach 30 Sekunden im sichtbaren Tab. Kein kostenpflichtiger Echtzeitdienst erforderlich. Einzigartige Datenbankbedingungen sichern Platz/Datum und Mitarbeiter/Datum auch gegen konkurrierende Schreibzugriffe. Nur das eigene ausgewählte Profil kann über die Oberfläche storniert werden. Vergangene Tage und Wochenenden sind serverseitig gesperrt. Die verbindliche Tages- und Wochengrenze der Datenbank ist **Europe/Vienna**; die Kalenderanzeige nutzt das lokale Browserdatum, vorgesehen für Nutzer in Österreich.

**Keine Anmeldung und keine echte Identitätsprüfung:** Wer den öffentlichen Link kennt, kann jeden Namen auswählen, Buchungen lesen, für diese Namen buchen und stornieren. Der Publishable Key ist kein Passwort. Diese Version bleibt ein einfacher Team-PoC; für geschützten Betrieb wären Authentifizierung und an Benutzer gebundene Berechtigungen erforderlich. Es werden keine Datenbankpasswörter oder privilegierten Schlüssel veröffentlicht.

Kosten und mögliche Pausierung richten sich nach dem Supabase-Tarif. Es wird kein kostenpflichtiger Dienst aktiviert. Historische Buchungen werden nicht automatisch gelöscht; die öffentliche Lesefunktion liefert nur das aktuelle Drei-Wochen-Fenster.

## GitHub Pages

Unter **Settings → Pages → Build and deployment → Source** einmalig **GitHub Actions** auswählen. Jeder Push auf `main` testet und baut die App und veröffentlicht `dist/`. Falls der erste Lauf vor Aktivierung von Pages fehlgeschlagen ist, unter **Actions → Deploy GitHub Pages → Run workflow** erneut starten. Die Website veröffentlicht den Anwendungscode und die neun Vornamen; Buchungen werden zur Laufzeit aus Supabase geladen.
