# ⚡ Energy Card

Eine übersichtliche Lovelace-Karte für Home Assistant im Glasmorphism-Stil. Zeigt alle Stromverbraucher sortiert nach aktuellem Verbrauch – der größte Verbraucher steht automatisch immer oben. Optional mit Gesamtverbrauch, Solar-Einspeisung, Akku-Ladestand und Zählerstand als Info-Kacheln.

## ✨ Features

- **Automatische Sortierung** – größter Stromverbraucher steht immer an erster Stelle
- **Relativer Balken** – zeigt den Verbrauch jedes Geräts im Verhältnis zum größten Verbraucher
- **Farbkodierung** – Grün (niedrig) → Gelb → Orange → Rot (hoch)
- **Info-Kacheln** – optional: Gesamtverbrauch, Solar-Einspeisung, Akku-Ladestand, Zählerstand
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
2. In den **Info-Kacheln** die gewünschten Entitäten eintragen (Gesamtverbrauch, Solar, Akku, Zähler)
3. Auf **„Alle Leistungs-Sensoren laden"** klicken – alle erkannten Sensoren werden in die Liste geladen
4. Einzelne Geräte über **×** entfernen oder weitere über das Suchfeld manuell hinzufügen

### Per YAML

#### Minimal

```yaml
type: custom:energy-card
entities:
  - sensor.waschmaschine_power
  - sensor.geschirrspueler_power
  - sensor.kuehlschrank_power
```

#### Mit Info-Kacheln

```yaml
type: custom:energy-card
title: Stromverbrauch
total_entity: sensor.gesamtverbrauch_power
solar_entity: sensor.photovoltaik_power
battery_entity: sensor.hausakku_soc
meter_entity: sensor.stromzaehler_energy
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
total_entity: sensor.gesamtverbrauch_power
solar_entity: sensor.photovoltaik_power
battery_entity: sensor.hausakku_soc
meter_entity: sensor.stromzaehler_energy
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
| `total_entity` | string | – | Entität für Gesamtverbrauch (W oder kW) |
| `solar_entity` | string | – | Entität für Solar-Einspeisung (W oder kW) |
| `battery_entity` | string | – | Entität für Akku-Ladestand (%) |
| `meter_entity` | string | – | Entität für Zählerstand (kWh) |
| `min_watt_filter` | number | `0` | Verbraucher unter diesem Wert (W) ausblenden |
| `columns` | number | `1` | Anzahl Spalten (1–3) |
| `max_height` | number | `0` | Max. Kartenhöhe in px (0 = unbegrenzt) |
| `border_radius` | number | `16` | Eckenradius in px |
| `icon_size` | number | `22` | Icon-Größe in px |

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
