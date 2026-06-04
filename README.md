# ⚡ Energy Card

Eine übersichtliche Lovelace-Karte für Home Assistant im Glasmorphism-Stil. Zeigt alle Stromverbraucher sortiert nach aktuellem Verbrauch – der größte Verbraucher steht automatisch immer oben. Optional mit Aktueller Verbrauch, Solar-Einspeisung, Akku-Ladestand, Zählerstand, Stromkosten sowie **automatisch berechnetem Tages- und Monatsverbrauch** als Info-Kacheln.

## ✨ Features

- **Automatische Sortierung** – größter Stromverbraucher steht immer an erster Stelle
- **Relativer Balken** – zeigt den Verbrauch jedes Geräts im Verhältnis zum größten Verbraucher
- **Farbkodierung** – Grün (niedrig) → Gelb → Orange → Rot (hoch)
- **Info-Kacheln** – optional: Aktueller Verbrauch, Solar-Einspeisung, Akku-Ladestand, Zählerstand, Stromkosten
- **Automatischer Tages- & Monatsverbrauch** – wird direkt aus den HA-Statistiken des Stromzählers berechnet, kein extra Sensor nötig
- **Automatische Einheitenerkennung** – Sensoren in W und kW werden automatisch erkannt und einheitlich angezeigt
- **Filter** – Geräte unter einem Mindestwert (z. B. Standby < 5 W) ausblenden
- **Visueller Editor** – alles per Maske einstellbar, kein YAML nötig
- **Glasmorphism-Design** – passend zu den anderen Widgets

## 📦 Installation

### Über HACS (empfohlen)

1. HACS → Frontend → ⋮ → **Custom Repositories**
2. URL: `https://github.com/pquandel2-alt/pq_energy_card` → Typ: **Lovelace**
3. Installieren und Seite neu laden

### Manuell

1. `energy-card.js` nach `/config/www/` kopieren
2. In `configuration.yaml` unter `lovelace → resources` eintragen:
   ```yaml
   resources:
     - url: /local/energy-card.js
       type: module
   ```

## ⚙️ Konfiguration

### Über den visuellen Editor (empfohlen)

1. Karte hinzufügen → **Energy Card** auswählen
2. In den **Info-Kacheln** die gewünschten Entitäten eintragen (Aktueller Verbrauch, Solar, Akku, Zähler …)
3. Sobald ein **Stromzähler** eingetragen ist, erscheinen Tages- und Monatsverbrauch **automatisch** – keine weiteren Sensoren nötig
4. Auf **„Alle Leistungs-Sensoren laden"** klicken – alle erkannten Sensoren werden in die Liste geladen
5. Einzelne Geräte über **×** entfernen oder weitere über das Suchfeld manuell hinzufügen

### Per YAML

#### Minimal

```yaml
type: custom:energy-card
entities:
  - sensor.waschmaschine_power
  - sensor.geschirrspueler_power
  - sensor.kuehlschrank_power
```

#### Mit Info-Kacheln (inkl. Auto-Statistiken)

```yaml
type: custom:energy-card
title: Stromverbrauch
total_entity: sensor.gesamtverbrauch_power
solar_entity: sensor.photovoltaik_power
battery_entity: sensor.hausakku_soc
meter_entity: sensor.stromzaehler_energy   # aktiviert automatisch Tages- & Monatsverbrauch
entities:
  - sensor.waschmaschine_power
  - sensor.geschirrspueler_power
  - sensor.kuehlschrank_power
  - sensor.tv_power
```

#### Vollständig

```yaml
type: custom:energy-card
title: Stromverbrauch
show_header: true
show_tiles: true
show_solar_ratio: false
total_entity: sensor.gesamtverbrauch_power
solar_entity: sensor.photovoltaik_power
battery_entity: sensor.hausakku_soc
meter_entity: sensor.stromzaehler_energy
cost_entity: sensor.stromkosten_heute
# optional: eigene Sensoren statt Auto-Berechnung
daily_entity: sensor.tagesverbrauch_kwh
monthly_entity: sensor.monatsverbrauch_kwh
entities:
  - sensor.waschmaschine_power
  - sensor.geschirrspueler_power
min_watt_filter: 5
columns: 1
max_height: 400
border_radius: 16
icon_size: 22
```

## 🔧 Optionen

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `entities` | liste | `[]` | Liste der Verbraucher-Entitäten |
| `title` | string | `Stromverbrauch` | Titel in der Kopfzeile |
| `show_header` | boolean | `true` | Kopfzeile anzeigen |
| `show_tiles` | boolean | `true` | Info-Kacheln anzeigen |
| `show_solar_ratio` | boolean | `false` | Solar-Eigenverbrauchsanteil (%) in Solar-Kachel anzeigen |
| `total_entity` | string | – | Entität für Aktuellen Verbrauch (W oder kW) |
| `solar_entity` | string | – | Entität für Solar-Einspeisung (W oder kW) |
| `battery_entity` | string | – | Entität für Akku-Ladestand (%) |
| `meter_entity` | string | – | Entität für Zählerstand (kWh) – aktiviert automatisch Tages- & Monatsverbrauch |
| `cost_entity` | string | – | Entität für Stromkosten |
| `daily_entity` | string | – | Optionaler eigener Sensor für Tagesverbrauch (überschreibt Auto-Berechnung) |
| `monthly_entity` | string | – | Optionaler eigener Sensor für Monatsverbrauch (überschreibt Auto-Berechnung) |
| `min_watt_filter` | number | `0` | Verbraucher unter diesem Wert (W) ausblenden |
| `columns` | number | `1` | Anzahl Spalten (1–3) |
| `max_height` | number | `0` | Max. Kartenhöhe in px (0 = unbegrenzt) |
| `border_radius` | number | `16` | Eckenradius in px |
| `icon_size` | number | `22` | Icon-Größe in px |

## 📊 Automatischer Tages- & Monatsverbrauch

Sobald `meter_entity` gesetzt ist, liest die Karte automatisch die HA-Recorder-Statistiken aus und berechnet:

- **Tagesverbrauch** – Verbrauch ab Mitternacht (heute)
- **Monatsverbrauch** – Verbrauch ab dem 1. des aktuellen Monats

Die Werte werden beim Laden und danach **alle 5 Minuten** aktualisiert. Bei Tageswechsel (Mitternacht) wird automatisch neu gerechnet. Es werden keine Utility-Meter-Helper oder zusätzliche Sensoren benötigt – der Stromzähler-Sensor muss lediglich Statistiken in HA aufzeichnen (Standard bei Sensoren mit `device_class: energy`).

## 🎨 Farbkodierung

Die Farbe jedes Verbrauchers richtet sich nach seinem Anteil am aktuell größten Verbraucher:

| Anteil | Farbe |
|---|---|
| < 25 % | 🟢 Grün |
| 25–50 % | 🟡 Gelb |
| 50–75 % | 🟠 Orange |
| > 75 % | 🔴 Rot |

## 🔍 Automatische Einheitenerkennung

Sensoren mit `unit_of_measurement: W` oder `kW` sowie `device_class: power` werden automatisch erkannt und einheitlich in W (unter 1000 W) bzw. kW (ab 1000 W) angezeigt.

## 🔗 Verwandte Projekte

- [Glass Button Card](https://github.com/pquandel2-alt/pq_glass-button-card) – Konfigurierbarer Button im gleichen Glasstil
- [Battery Card](https://github.com/pquandel2-alt/pq_battery_card) – Batteriestände aller Geräte im gleichen Glasstil
- [Trash Widget Card](https://github.com/pquandel2-alt/pq_trash_widget_card) – Müllabholtermin im gleichen Glasstil
- [Weather Widget Card](https://github.com/pquandel2-alt/pq_weather_widget_card) – Wetter im gleichen Glasstil
