// =====================================================================
//  Energy Card v1.0.9
// =====================================================================

function formatPower(watts) {
  if (watts === null || watts === undefined || isNaN(watts)) return '–';
  if (Math.abs(watts) >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
  return `${Math.round(watts)} W`;
}

function getStateWatts(st) {
  if (!st) return null;
  const val = parseFloat(st.state);
  if (isNaN(val)) return null;
  const unit = (st.attributes?.unit_of_measurement || '').trim().toLowerCase();
  return unit === 'kw' ? val * 1000 : val;
}

function getConsumptionColor(ratio) {
  if (ratio < 0.25) return '#4CAF50';
  if (ratio < 0.5)  return '#FFC107';
  if (ratio < 0.75) return '#FF9800';
  return '#F44336';
}

function getAllPowerEntities(hass) {
  return Object.keys(hass.states).filter(id => {
    const attr = hass.states[id]?.attributes || {};
    const unit = (attr.unit_of_measurement || '').trim().toLowerCase();
    return attr.device_class === 'power' || unit === 'w' || unit === 'kw';
  });
}

// =====================================================================
//  Haupt-Card
// =====================================================================
class EnergyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._lastKey = null;
    this._statsDaily   = undefined;
    this._statsMonthly = undefined;
    this._lastStatsFetch = 0;
    this._statsDate = '';
  }

  setConfig(config) {
    if (!config) throw new Error('Keine Konfiguration');
    const prevMeter = this._config?.meter_entity;
    this._config = {
      title: 'Stromverbrauch',
      show_header: true,
      show_tiles: true,
      show_solar_ratio: false,
      columns: 1,
      max_height: 0,
      min_watt_filter: 0,
      border_radius: 16,
      icon_size: 22,
      ...config,
    };
    if (!Array.isArray(this._config.entities)) this._config.entities = [];
    if (prevMeter !== this._config.meter_entity) {
      this._statsDaily   = undefined;
      this._statsMonthly = undefined;
      this._lastStatsFetch = 0;
      this._statsDate = '';
    }
    delete this._lastKey;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
    const now = Date.now();
    const today = new Date().toDateString();
    if (now - this._lastStatsFetch > 300000 || this._statsDate !== today) {
      this._lastStatsFetch = now;
      this._statsDate = today;
      this._fetchStats();
    }
  }

  async _fetchStats() {
    if (!this._hass || !this._config.meter_entity) return;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    try {
      const [dayRes, monRes] = await Promise.all([
        this._hass.callWS({
          type: 'recorder/statistics_during_period',
          start_time: todayStart,
          statistic_ids: [this._config.meter_entity],
          period: 'hour',
          types: ['change'],
        }),
        this._hass.callWS({
          type: 'recorder/statistics_during_period',
          start_time: monthStart,
          statistic_ids: [this._config.meter_entity],
          period: 'day',
          types: ['change'],
        }),
      ]);
      const id = this._config.meter_entity;
      const sumChange = arr => (arr || []).reduce((s, x) => s + (x.change ?? 0), 0);
      this._statsDaily   = sumChange(dayRes[id]);
      this._statsMonthly = sumChange(monRes[id]);
      this._lastKey = null;
      this._render();
    } catch (e) {
      console.error('[EnergyCard] Statistik-Fehler:', e);
    }
  }

  _getConsumers() {
    if (!this._hass) return [];
    const min = parseFloat(this._config.min_watt_filter) || 0;
    return this._config.entities
      .map(e => {
        const id = typeof e === 'string' ? e : e?.entity;
        if (!id) return null;
        const st = this._hass.states[id];
        if (!st) return null;
        const watts = getStateWatts(st);
        const customName = typeof e === 'object' && e.name ? e.name : null;
        return {
          id,
          name: customName || st.attributes.friendly_name || id,
          watts,
          icon: st.attributes.icon || 'mdi:flash',
          unavailable: st.state === 'unavailable' || st.state === 'unknown',
        };
      })
      .filter(Boolean)
      .filter(c => c.unavailable || c.watts === null || c.watts >= min)
      .sort((a, b) => (b.watts ?? -1) - (a.watts ?? -1));
  }

  getCardSize() {
    const tiles = [this._config.total_entity, this._config.solar_entity,
                   this._config.battery_entity, this._config.meter_entity,
                   this._config.cost_entity, this._config.daily_entity,
                   this._config.monthly_entity].filter(Boolean).length;
    const tileRows = this._config.show_tiles && tiles > 0 ? Math.ceil(tiles / 2) : 0;
    const rows = Math.ceil(this._getConsumers().length / (this._config.columns || 1));
    return Math.max(2, tileRows * 2 + rows + (this._config.show_header ? 1 : 0));
  }

  static getConfigElement() { return document.createElement('energy-card-editor'); }
  static getStubConfig() {
    return { entities: [], show_header: true, show_tiles: true, title: 'Stromverbrauch' };
  }

  _tile(icon, label, value, color, subValue = null) {
    return `
      <div class="tile" style="border-color:${color}44;">
        <ha-icon icon="${icon}" style="--mdc-icon-size:22px;color:${color};flex-shrink:0;"></ha-icon>
        <div class="tile-info">
          <span class="tile-label">${label}</span>
          <span class="tile-value" style="color:${color};">${value}</span>
          ${subValue ? `<span class="tile-sub">${subValue}</span>` : ''}
        </div>
      </div>`;
  }

  _render() {
    if (!this._hass) return;
    const cfg = this._config;
    const consumers = this._getConsumers();

    const totalSt   = cfg.total_entity   ? this._hass.states[cfg.total_entity]   : null;
    const solarSt   = cfg.solar_entity   ? this._hass.states[cfg.solar_entity]   : null;
    const batterySt = cfg.battery_entity ? this._hass.states[cfg.battery_entity] : null;
    const meterSt   = cfg.meter_entity   ? this._hass.states[cfg.meter_entity]   : null;
    const costSt    = cfg.cost_entity    ? this._hass.states[cfg.cost_entity]    : null;

    const totalWatts   = getStateWatts(totalSt);
    const solarWatts   = getStateWatts(solarSt);
    const battPct      = batterySt ? parseFloat(batterySt.state) : null;
    const meterVal     = meterSt   ? parseFloat(meterSt.state)   : null;
    const meterUnit    = meterSt?.attributes?.unit_of_measurement || 'kWh';
    const costVal      = costSt    ? parseFloat(costSt.state)    : null;
    const costUnit     = costSt?.attributes?.unit_of_measurement || '';

    const dailySt    = cfg.daily_entity   ? this._hass.states[cfg.daily_entity]   : null;
    const monthlySt  = cfg.monthly_entity ? this._hass.states[cfg.monthly_entity] : null;
    const dailyVal   = dailySt ? parseFloat(dailySt.state)
                     : (this._statsDaily   !== undefined ? this._statsDaily   : null);
    const dailyUnit  = dailySt?.attributes?.unit_of_measurement  || 'kWh';
    const monthlyVal = monthlySt ? parseFloat(monthlySt.state)
                     : (this._statsMonthly !== undefined ? this._statsMonthly : null);
    const monthlyUnit = monthlySt?.attributes?.unit_of_measurement || 'kWh';

    const showDaily   = !!(cfg.daily_entity   || cfg.meter_entity);
    const showMonthly = !!(cfg.monthly_entity || cfg.meter_entity);

    const solarRatio = cfg.show_solar_ratio && solarWatts !== null && totalWatts !== null && totalWatts > 0
      ? Math.min(100, Math.round((solarWatts / totalWatts) * 100))
      : null;

    const hasTiles = cfg.show_tiles &&
      (cfg.total_entity || cfg.solar_entity || cfg.battery_entity || cfg.meter_entity || cfg.cost_entity ||
       cfg.daily_entity || cfg.monthly_entity);
    const tileCount = [cfg.total_entity, cfg.solar_entity, cfg.battery_entity, cfg.meter_entity,
                       cfg.cost_entity,
                       showDaily   ? 'daily'   : null,
                       showMonthly ? 'monthly' : null].filter(Boolean).length;

    const maxWatts = Math.max(...consumers.map(c => c.watts ?? 0), 1);
    const br   = cfg.border_radius ?? 16;
    const cols = Math.max(1, cfg.columns || 1);

    const key = [
      consumers.map(c => `${c.id}:${c.watts}`).join('|'),
      totalWatts, solarWatts, battPct, meterVal, costVal,
      showDaily ? dailyVal : '', showMonthly ? monthlyVal : '',
      JSON.stringify(cfg),
    ].join('_');
    if (key === this._lastKey) return;
    this._lastKey = key;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; box-sizing:border-box; }
        .card {
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.15);
          border-radius:${br}px;
          padding:14px;
          box-sizing:border-box;
        }
        .header {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;
        }
        .title { font-size:13px; font-weight:600; color:rgba(255,255,255,0.85); letter-spacing:0.3px; }
        .badge {
          font-size:11px; padding:2px 9px; border-radius:10px; font-weight:600;
          background:rgba(255,152,0,0.18); color:#FF9800; border:1px solid rgba(255,152,0,0.35);
        }
        .badge-neutral {
          background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.45);
          border:1px solid rgba(255,255,255,0.1);
        }
        .tiles {
          display:grid;
          grid-template-columns:${tileCount === 1 ? '1fr' : '1fr 1fr'};
          gap:8px;
          margin-bottom:14px;
        }
        .tile {
          display:flex; align-items:center; gap:10px; padding:10px 12px;
          border-radius:${Math.max(6, br - 8)}px;
          background:rgba(255,255,255,0.04);
          border:1px solid transparent;
        }
        .tile-info { display:flex; flex-direction:column; gap:2px; min-width:0; }
        .tile-label {
          font-size:10px; color:rgba(255,255,255,0.45);
          text-transform:uppercase; letter-spacing:0.4px;
        }
        .tile-value { font-size:15px; font-weight:700; white-space:nowrap; }
        .tile-sub { font-size:10px; color:rgba(255,255,255,0.45); margin-top:1px; }
        .grid {
          display:grid; grid-template-columns:repeat(${cols},1fr); gap:6px;
          ${cfg.max_height ? `max-height:${cfg.max_height}px;overflow-y:auto;padding-right:2px;` : ''}
        }
        .consumer-row {
          display:flex; align-items:center; gap:8px; padding:7px 8px;
          border-radius:${Math.max(6, br - 8)}px;
          background:rgba(255,255,255,0.03); transition:background 0.2s;
        }
        .consumer-row:hover { background:rgba(255,255,255,0.07); }
        .unavailable { opacity:0.4; }
        ha-icon { --mdc-icon-size:${cfg.icon_size ?? 22}px; flex-shrink:0; }
        .info { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
        .name {
          font-size:12px; color:rgba(255,255,255,0.75);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1;
        }
        .bar-bg { height:3px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden; }
        .bar-fill { height:100%; border-radius:2px; transition:width 0.5s ease, background-color 0.3s; }
        .watt-val {
          font-size:12px; font-weight:600; min-width:54px; text-align:right;
          flex-shrink:0; line-height:1; font-variant-numeric:tabular-nums;
        }
        .empty { font-size:12px; color:rgba(255,255,255,0.3); text-align:center; padding:16px 0; }
      </style>
      <div class="card">

        ${cfg.show_header ? `
          <div class="header">
            <span class="title">${cfg.title || 'Stromverbrauch'}</span>
          </div>
        ` : ''}

        ${hasTiles ? `
          <div class="tiles">
            ${cfg.total_entity   ? this._tile('mdi:transmission-tower',  'Aktueller Verbrauch', formatPower(totalWatts), '#FF9800') : ''}
            ${cfg.solar_entity   ? this._tile('mdi:solar-power-variant', 'Solar', formatPower(solarWatts), '#4CAF50',
                solarRatio !== null ? `${solarRatio} % Eigenverbrauch` : null) : ''}
            ${cfg.battery_entity ? this._tile('mdi:battery-charging',    'Akku',
                !isNaN(battPct) ? `${Math.round(battPct)}&thinsp;%` : '–', '#42A5F5') : ''}
            ${cfg.meter_entity   ? this._tile('mdi:counter',             'Z&auml;hlerstand',
                !isNaN(meterVal) ? `${meterVal.toFixed(1)}&thinsp;${meterUnit}` : '–', '#AB47BC') : ''}
            ${cfg.cost_entity    ? this._tile('mdi:currency-eur',        'Stromkosten',
                !isNaN(costVal) ? `${costVal.toFixed(2)}&thinsp;${costUnit}` : '–', '#66BB6A') : ''}
            ${showDaily   ? this._tile('mdi:calendar-today', 'Tagesverbrauch',
                dailyVal !== null && !isNaN(dailyVal) ? `${dailyVal.toFixed(2)}&thinsp;${dailyUnit}` : '–', '#26C6DA') : ''}
            ${showMonthly ? this._tile('mdi:calendar-month', 'Monatsverbrauch',
                monthlyVal !== null && !isNaN(monthlyVal) ? `${monthlyVal.toFixed(2)}&thinsp;${monthlyUnit}` : '–', '#7E57C2') : ''}
          </div>
        ` : ''}

        ${consumers.length === 0
          ? `<div class="empty">Keine Verbraucher konfiguriert</div>`
          : `<div class="grid">
              ${consumers.map(c => {
                const ratio = c.watts !== null && c.watts > 0 ? c.watts / maxWatts : 0;
                const color = c.watts !== null && c.watts > 0
                  ? getConsumptionColor(ratio)
                  : 'rgba(255,255,255,0.25)';
                return `
                  <div class="consumer-row ${c.unavailable ? 'unavailable' : ''}">
                    <ha-icon icon="${c.icon}" style="color:${color};"></ha-icon>
                    <div class="info">
                      <span class="name" title="${c.name}">${c.name}</span>
                      <div class="bar-bg">
                        <div class="bar-fill" style="width:${Math.round(ratio * 100)}%;background:${color};"></div>
                      </div>
                    </div>
                    <span class="watt-val" style="color:${color};">
                      ${c.unavailable ? '&ndash;' : formatPower(c.watts)}
                    </span>
                  </div>`;
              }).join('')}
            </div>`
        }
      </div>
    `;
  }
}

customElements.define('energy-card', EnergyCard);

// =====================================================================
//  Visueller Editor
// =====================================================================
class EnergyCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = { entities: [] };
    this._hass   = null;
    this._rendered = false;
  }

  setConfig(config) {
    this._config = { ...config };
    if (!Array.isArray(this._config.entities)) this._config.entities = [];
    if (this._rendered) {
      // Eingabefelder der 4 Sonder-Entitäten mit geladenen Werten synchronisieren
      const root = this.shadowRoot;
      const active = root.activeElement;
      [['total_entity','field_total'], ['solar_entity','field_solar'],
       ['battery_entity','field_battery'], ['meter_entity','field_meter'],
       ['cost_entity','field_cost'], ['daily_entity','field_daily'],
       ['monthly_entity','field_monthly']].forEach(([key, fieldId]) => {
        const container = root.getElementById(fieldId);
        if (!container) return;
        const input   = container.querySelector('input[type=text]');
        const clrBtn  = container.querySelector('button');
        if (input && active !== input) {
          input.value = this._config[key] || '';
          if (clrBtn) clrBtn.style.display = this._config[key] ? 'block' : 'none';
        }
      });
      this._updateEntityList();
      this._updatePicker();
    } else {
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._render();
    } else {
      const root   = this.shadowRoot;
      const active = root.activeElement;
      const list   = root.getElementById('entityList');
      const picker = root.getElementById('pickerContainer');
      if (!active || !list   || !list.contains(active))   this._updateEntityList();
      if (!active || !picker || !picker.contains(active)) this._updatePicker();
    }
  }

  _emit() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config } },
      bubbles: true, composed: true,
    }));
  }

  _getEntityIds() {
    return (this._config.entities || [])
      .map(e => (typeof e === 'string' ? e : e?.entity))
      .filter(Boolean);
  }

  // ---- Autocomplete-Feld für eine einzelne Entität ----
  _buildEntityField(root, fieldId, label, configKey) {
    const container = root.getElementById(fieldId);
    if (!container) return;
    container.innerHTML = '';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size:13px;font-weight:500;color:var(--primary-text-color,#212121);display:block;margin-bottom:5px;';
    container.appendChild(lbl);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;';

    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;align-items:center;border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;background:var(--card-background-color,#fff);overflow:hidden;';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = this._config[configKey] || '';
    input.placeholder = 'entity_id…';
    input.style.cssText = 'flex:1;padding:9px 11px;border:none;outline:none;background:transparent;color:var(--primary-text-color,#212121);font-size:13px;';

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '×';
    clearBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--secondary-text-color,#aaa);font-size:18px;padding:0 10px;line-height:1;display:' + (this._config[configKey] ? 'block' : 'none') + ';';
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      const cfg = { ...this._config };
      delete cfg[configKey];
      this._config = cfg;
      this._emit();
    });

    inputRow.appendChild(input);
    inputRow.appendChild(clearBtn);

    const dropdown = document.createElement('div');
    dropdown.style.cssText = 'position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:none;margin-top:2px;';

    const showSuggestions = (filter) => {
      dropdown.innerHTML = '';
      if (!this._hass) return;
      const lower = filter.toLowerCase().trim();
      if (!lower) { dropdown.style.display = 'none'; return; }
      const matches = Object.keys(this._hass.states)
        .filter(id => {
          const fn = (this._hass.states[id]?.attributes?.friendly_name || '').toLowerCase();
          return id.toLowerCase().includes(lower) || fn.includes(lower);
        })
        .slice(0, 8);
      if (matches.length === 0) { dropdown.style.display = 'none'; return; }
      matches.forEach(id => {
        const fn = this._hass.states[id]?.attributes?.friendly_name || id;
        const item = document.createElement('div');
        item.style.cssText = 'padding:7px 11px;cursor:pointer;border-bottom:1px solid var(--divider-color,#f0f0f0);';
        item.innerHTML = `<div style="font-size:12px;font-weight:500;">${fn}</div><div style="font-size:10px;color:var(--secondary-text-color,#727272);">${id}</div>`;
        item.addEventListener('mouseover', () => { item.style.background = 'var(--secondary-background-color,#f5f5f5)'; });
        item.addEventListener('mouseout',  () => { item.style.background = ''; });
        item.addEventListener('mousedown', ev => {
          ev.preventDefault();
          input.value = id;
          clearBtn.style.display = 'block';
          dropdown.style.display = 'none';
          this._config = { ...this._config, [configKey]: id };
          this._emit();
        });
        dropdown.appendChild(item);
      });
      dropdown.style.display = 'block';
    };

    input.addEventListener('input', () => showSuggestions(input.value));
    input.addEventListener('focus', () => showSuggestions(input.value));
    input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));
    input.addEventListener('change', () => {
      const v = input.value.trim();
      this._config = { ...this._config, [configKey]: v || undefined };
      clearBtn.style.display = v ? 'block' : 'none';
      this._emit();
    });

    wrap.appendChild(inputRow);
    wrap.appendChild(dropdown);
    container.appendChild(wrap);
  }

  // ---- Verbraucherliste aktualisieren ----
  _updateEntityList() {
    const list = this.shadowRoot.getElementById('entityList');
    if (!list) return;
    list.innerHTML = '';
    const entities = this._config.entities || [];

    if (entities.length === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = 'font-size:12px;color:var(--secondary-text-color,#888);padding:4px 0;';
      msg.textContent = 'Noch keine Verbraucher hinzugefügt.';
      list.appendChild(msg);
      return;
    }

    entities.forEach((entityObj, i) => {
      const entityId  = typeof entityObj === 'string' ? entityObj : entityObj?.entity;
      if (!entityId) return;
      const customName = typeof entityObj === 'object' && entityObj.name ? entityObj.name : '';
      const st    = this._hass?.states[entityId];
      const fn    = st?.attributes?.friendly_name || entityId;
      const watts = getStateWatts(st);
      const color = watts !== null && watts > 0 ? getConsumptionColor(0.5) : 'var(--secondary-text-color,#aaa)';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:var(--secondary-background-color,#f5f5f5);margin-bottom:4px;';

      const ic = document.createElement('ha-icon');
      ic.setAttribute('icon', st?.attributes?.icon || 'mdi:flash');
      ic.style.cssText = `--mdc-icon-size:18px;color:${color};flex-shrink:0;`;

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = customName || fn;
      nameInput.style.cssText = 'flex:1;border:1px solid transparent;border-radius:4px;outline:none;background:transparent;font-size:12px;color:var(--primary-text-color,#212121);min-width:0;padding:2px 4px;';
      nameInput.addEventListener('focus', () => {
        nameInput.style.borderColor = 'var(--primary-color,#03a9f4)';
        nameInput.style.background  = 'var(--card-background-color,#fff)';
      });
      nameInput.addEventListener('blur', () => {
        nameInput.style.borderColor = 'transparent';
        nameInput.style.background  = 'transparent';
      });
      nameInput.addEventListener('change', () => {
        const ents = [...(this._config.entities || [])];
        const newName = nameInput.value.trim();
        // Kein Custom-Override nötig wenn Name dem Friendly-Name entspricht
        ents[i] = (newName && newName !== fn) ? { entity: entityId, name: newName } : entityId;
        this._config = { ...this._config, entities: ents };
        this._emit();
      });

      const wattEl = document.createElement('span');
      wattEl.textContent = formatPower(watts);
      wattEl.style.cssText = `font-size:12px;font-weight:600;color:${color};min-width:50px;text-align:right;flex-shrink:0;`;

      const btn = document.createElement('button');
      btn.textContent = '×';
      btn.title = 'Entfernen';
      btn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--error-color,#f44336);font-size:18px;padding:0 2px;line-height:1;flex-shrink:0;';
      btn.addEventListener('click', () => {
        const ents = [...(this._config.entities || [])];
        ents.splice(i, 1);
        this._config = { ...this._config, entities: ents };
        this._emit();
        this._updateEntityList();
        this._updatePicker();
      });

      row.appendChild(ic); row.appendChild(nameInput); row.appendChild(wattEl); row.appendChild(btn);
      list.appendChild(row);
    });
  }

  // ---- Picker für neue Verbraucher ----
  _updatePicker() {
    const container = this.shadowRoot.getElementById('pickerContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!this._hass) return;

    const current = this._getEntityIds();
    const available = getAllPowerEntities(this._hass)
      .filter(id => !current.includes(id))
      .sort((a, b) => {
        const wa = getStateWatts(this._hass.states[a]) ?? -1;
        const wb = getStateWatts(this._hass.states[b]) ?? -1;
        return wb - wa;
      });

    const picker = document.createElement('ha-entity-picker');
    picker.hass = this._hass;
    picker.value = '';
    picker.setAttribute('allow-custom-entity', '');
    picker.style.cssText = 'display:block;width:100%;';
    picker.entityFilter = stateObj => {
      const unit = (stateObj.attributes.unit_of_measurement || '').trim().toLowerCase();
      return (stateObj.attributes.device_class === 'power' || unit === 'w' || unit === 'kw')
        && !current.includes(stateObj.entity_id);
    };
    picker.addEventListener('value-changed', e => {
      const id = e.detail.value;
      if (!id) return;
      picker.value = '';
      this._config = { ...this._config, entities: [...this._getEntityIds(), id] };
      this._emit();
      this._updateEntityList();
      this._updatePicker();
    });
    container.appendChild(picker);
  }

  _render() {
    this._rendered = true;
    const root = this.shadowRoot;
    const c = this._config;

    root.innerHTML = `
      <style>
        .editor { display:flex; flex-direction:column; gap:14px; padding:8px 0; }
        .section {
          font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px;
          color:var(--secondary-text-color,#727272); margin-top:6px;
          border-bottom:1px solid var(--divider-color,#e0e0e0); padding-bottom:4px;
        }
        .field { display:flex; flex-direction:column; gap:5px; }
        .row { display:flex; gap:12px; }
        .row .field { flex:1; }
        label { font-size:13px; font-weight:500; color:var(--primary-text-color,#212121); }
        .hint { font-size:11px; color:var(--secondary-text-color,#727272); }
        input[type=text], input[type=number], select {
          padding:9px 11px; border-radius:8px; border:1px solid var(--divider-color,#e0e0e0);
          background:var(--card-background-color,#fff); color:var(--primary-text-color,#212121);
          font-size:13px; outline:none; box-sizing:border-box; width:100%; }
        input[type=text]:focus, input[type=number]:focus, select:focus {
          border-color:var(--primary-color,#03a9f4); }
        .toggle-row { display:flex; align-items:center; justify-content:space-between; padding:4px 0; }
        .toggle-row label { flex:1; }
        .load-btn {
          width:100%; padding:9px 14px; border-radius:8px; border:none; cursor:pointer;
          background:var(--primary-color,#03a9f4); color:#fff;
          font-size:13px; font-weight:500; display:flex; align-items:center; gap:8px; }
        .load-btn:hover { opacity:0.9; }
        #entityList { display:flex; flex-direction:column; }
        #pickerContainer { margin-top:4px; }
      </style>
      <div class="editor">

        <div class="section">Info-Kacheln</div>
        <div class="hint">Optionale &Uuml;bersichtswerte oben auf der Karte. Felder freilassen um eine Kachel auszublenden.</div>
        <div class="row">
          <div class="field" id="field_total"></div>
          <div class="field" id="field_solar"></div>
        </div>
        <div class="row">
          <div class="field" id="field_battery"></div>
          <div class="field" id="field_meter"></div>
        </div>
        <div class="row">
          <div class="field" id="field_cost"></div>
          <div class="field" id="field_daily"></div>
        </div>
        <div class="row">
          <div class="field" id="field_monthly"></div>
          <div class="field"></div>
        </div>
        <div class="toggle-row">
          <label>Solar-Eigenverbrauchsanteil anzeigen</label>
          <input type="checkbox" id="show_solar_ratio" ${c.show_solar_ratio ? 'checked' : ''} />
        </div>
        <div class="hint">Zeigt in der Solar-Kachel wie viel % des Gesamtverbrauchs durch Solar gedeckt wird (ben&ouml;tigt Solar + Gesamtverbrauch).</div>
        <div class="hint" style="margin-top:4px;">Tagesverbrauch &amp; Monatsverbrauch werden automatisch aus den HA-Statistiken des Stromz&auml;hlers berechnet. Die Felder unten sind nur n&ouml;tig, wenn du eigene Sensoren verwenden m&ouml;chtest.</div>

        <div class="section">Verbraucher</div>
        <button class="load-btn" id="loadAllBtn">
          <ha-icon icon="mdi:lightning-bolt" style="--mdc-icon-size:18px;"></ha-icon>
          <span>Alle Leistungs-Sensoren laden</span>
        </button>
        <div class="hint">L&auml;dt alle Sensoren mit device_class: power oder Einheit W/kW.</div>
        <div id="entityList"></div>
        <div id="pickerContainer"></div>

        <div class="section">Filter</div>
        <div class="field">
          <label>Nur anzeigen ab (W)</label>
          <input type="number" id="min_watt_filter" value="${c.min_watt_filter ?? 0}" min="0" step="1" placeholder="0" />
        </div>

        <div class="section">Darstellung</div>
        <div class="toggle-row">
          <label>Kopfzeile anzeigen</label>
          <input type="checkbox" id="show_header" ${c.show_header !== false ? 'checked' : ''} />
        </div>
        <div id="titleField" style="${c.show_header !== false ? '' : 'display:none'}">
          <div class="field" style="margin-top:4px;">
            <label>Titel</label>
            <input type="text" id="title" value="${c.title || 'Stromverbrauch'}" placeholder="Stromverbrauch" />
          </div>
        </div>
        <div class="toggle-row">
          <label>Info-Kacheln anzeigen</label>
          <input type="checkbox" id="show_tiles" ${c.show_tiles !== false ? 'checked' : ''} />
        </div>
        <div class="row">
          <div class="field">
            <label>Spalten</label>
            <select id="columns">
              <option value="1" ${(c.columns||1)===1?'selected':''}>1 Spalte</option>
              <option value="2" ${(c.columns||1)===2?'selected':''}>2 Spalten</option>
              <option value="3" ${(c.columns||1)===3?'selected':''}>3 Spalten</option>
            </select>
          </div>
          <div class="field">
            <label>Max. H&ouml;he (px, 0 = unbegrenzt)</label>
            <input type="number" id="max_height" value="${c.max_height || 0}" min="0" step="10" />
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Eckenradius (px)</label>
            <input type="number" id="border_radius" value="${c.border_radius ?? 16}" min="0" max="40" />
          </div>
          <div class="field">
            <label>Icon-Gr&ouml;&szlig;e (px)</label>
            <input type="number" id="icon_size" value="${c.icon_size ?? 22}" min="14" max="40" />
          </div>
        </div>

      </div>
    `;

    // Autocomplete-Felder für die Sonder-Entitäten
    this._buildEntityField(root, 'field_total',   'Gesamtverbrauch',  'total_entity');
    this._buildEntityField(root, 'field_solar',   'Solar-Einspeisung','solar_entity');
    this._buildEntityField(root, 'field_battery', 'Akku-Ladestand',   'battery_entity');
    this._buildEntityField(root, 'field_meter',   'Stromzähler',      'meter_entity');
    this._buildEntityField(root, 'field_cost',    'Stromkosten',      'cost_entity');
    this._buildEntityField(root, 'field_daily',   'Tagesverbrauch',   'daily_entity');
    this._buildEntityField(root, 'field_monthly', 'Monatsverbrauch',  'monthly_entity');

    this._updateEntityList();
    this._updatePicker();

    // "Alle Leistungs-Sensoren laden"
    root.getElementById('loadAllBtn').addEventListener('click', () => {
      if (!this._hass) return;
      const all = getAllPowerEntities(this._hass);
      this._config = { ...this._config, entities: all };
      this._emit();
      this._updateEntityList();
      this._updatePicker();
    });

    root.getElementById('show_header').addEventListener('change', e => {
      this._config = { ...this._config, show_header: e.target.checked };
      this._emit();
      root.getElementById('titleField').style.display = e.target.checked ? '' : 'none';
    });
    root.getElementById('title').addEventListener('change', e => {
      this._config = { ...this._config, title: e.target.value }; this._emit();
    });
    root.getElementById('show_tiles').addEventListener('change', e => {
      this._config = { ...this._config, show_tiles: e.target.checked }; this._emit();
    });
    root.getElementById('show_solar_ratio').addEventListener('change', e => {
      this._config = { ...this._config, show_solar_ratio: e.target.checked }; this._emit();
    });
    root.getElementById('columns').addEventListener('change', e => {
      this._config = { ...this._config, columns: parseInt(e.target.value) }; this._emit();
    });
    root.getElementById('min_watt_filter').addEventListener('change', e => {
      this._config = { ...this._config, min_watt_filter: parseFloat(e.target.value) || 0 }; this._emit();
    });
    root.getElementById('max_height').addEventListener('change', e => {
      this._config = { ...this._config, max_height: parseInt(e.target.value) || 0 }; this._emit();
    });
    root.getElementById('border_radius').addEventListener('change', e => {
      this._config = { ...this._config, border_radius: parseInt(e.target.value) }; this._emit();
    });
    root.getElementById('icon_size').addEventListener('change', e => {
      this._config = { ...this._config, icon_size: parseInt(e.target.value) }; this._emit();
    });
  }
}

customElements.define('energy-card-editor', EnergyCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'energy-card',
  name: 'Energy Card',
  description: 'Zeigt alle Stromverbraucher sortiert nach aktuellem Verbrauch, mit Solar, Akku und Zählerstand',
  preview: true,
});
