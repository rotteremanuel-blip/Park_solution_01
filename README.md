# Parkplatz – PoC V1

Responsive Parkplatzreservierung für neun Mitarbeitende und vier gleichwertige Stellplätze. React, TypeScript, Vite und Tailwind CSS; ohne Backend, Login oder externe Infrastruktur.

## Voraussetzungen und Start

Node.js 22.12 oder neuer und npm.

```sh
npm install
npm run dev
```

Vite zeigt die lokale Adresse im Terminal. Auf dem Smartphone kann die Netzwerkadresse des Entwicklungsrechners im gleichen WLAN genutzt werden. Für reproduzierbare Installation mit vorhandener Lockdatei: `npm ci`.

```sh
npm test          # Automatisierte Kalender-, Buchungs- und Persistenztests
npm run build    # TypeScript-Prüfung und Production-Build in dist/
npm run preview  # Gebauten Stand lokal prüfen
```

## Namen ändern

Die neun Mitarbeitenden stehen in `src/config.ts`: Simone, Markus, Benjamin, Andreas, Amir, Thomas, Nicolas, Philipp und Emanuel. Zum Umbenennen nur `name` ändern; die stabilen IDs unverändert lassen, damit vorhandene Buchungen zugeordnet bleiben. Dort sind auch P1 bis P4 definiert.

## Aufbau und Entscheidungen

- `src/domain.ts`: Datenmodell, ISO-Kalenderwochen, lokale Datumsberechnung, Buchungs- und Stornoregeln.
- `src/storage.ts`: austauschbare Persistenzschicht, Validierung und Laden. Ungültige Einträge werden verworfen, bei Konflikten bleibt der erste gültige Eintrag erhalten.
- `src/main.tsx`: Oberfläche, Namenswahl, drei Wochen, Stornodialog.
- `src/style.css`: Tailwind und responsive Gestaltung; das Raster scrollt auf kleinen Displays horizontal.

Buchbar sind Werktage der aktuellen und der zwei folgenden Kalenderwochen ab dem lokalen heutigen Datum. Eine Reservierung gilt für den ganzen Tag. Wochenenden bleiben ausgeblendet. Der heutige Tag wird alle 30 Sekunden sowie beim Fensterfokus aktualisiert. Vor jedem Schreibvorgang wird der aktuelle Speicherstand erneut gelesen; andere Tabs werden über Storage-Ereignisse aktualisiert. Schreibfehler werden angezeigt, ohne eine erfolgreiche Speicherung vorzutäuschen.

## Grenzen von V1 und Weiterentwicklung

localStorage gehört zum jeweiligen Browserprofil und Ursprung. Keine Synchronisierung zwischen Geräten oder Browsern, keine verifizierte Identität und keine Zugriffssicherheit durch die Namenswahl. Browserdatenlöschung entfernt Buchungen. Auch parallele Tabs können ohne atomare zentrale Speicherung konkurrieren; verbindliches First-Come-First-Served über mehrere Nutzer ist nicht gewährleistet. Beschädigte Speicherdaten werden robust gefiltert; bei gesperrtem Speicher ist dauerhaftes Speichern nicht möglich.

Für einen späteren Mehrnutzerbetrieb kann die Persistenzschicht durch eine asynchrone API ersetzt werden. Eine zentrale Datenbank muss Parkplatz/Datum und Mitarbeiter/Datum jeweils eindeutig absichern; Identität und Schreibrechte müssen dann serverseitig geprüft werden. Das ist ausdrücklich nicht Teil dieser Version.

## Veröffentlichung mit GitHub Pages

Im GitHub-Repository unter **Settings → Pages → Build and deployment → Source** einmalig **GitHub Actions** auswählen. Unter **Actions → Deploy GitHub Pages → Run workflow** den Workflow auf `main` starten, falls der erste Lauf vor Aktivierung von Pages fehlgeschlagen ist. Danach veröffentlicht jeder Push auf `main` automatisch den getesteten Production-Build.

Die Website liegt nach erfolgreicher Veröffentlichung unter https://rotteremanuel-blip.github.io/Park_solution_01/ . Die relative Vite-Basis unterstützt den Repository-Unterpfad. Die Veröffentlichung teilt nur die Anwendung, keine Browser-Buchungen. Der öffentliche Build enthält die neun konfigurierten Vornamen, aber keine Anmeldedaten oder lokal erstellten Reservierungen.
