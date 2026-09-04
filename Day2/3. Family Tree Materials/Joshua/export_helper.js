/**
 * export_helper.js
 *
 * Save / load / export / import for a family-chart (donatso) tree - and
 * nothing else.
 *
 * The helper never builds a chart, never defines fields, cards, themes or
 * sample data. You create the chart however you like; you hand it here and
 * get three things back:
 *
 *   store()          -> write the current tree to localStorage
 *   exportToFile()   -> download it as JSON
 *   importFromFile() -> read a JSON file back and put it on the chart
 *
 * The only chart methods it touches are the public ones: store.getData(),
 * getMainDatum(), updateData(), updateMainId(), updateTree().
 *
 *   <script src="family-chart.min.js"></script>
 *   <script src="export_helper.js"></script>
 *   <script>
 *     const chart = f3.createChart('#FamilyChart', data);
 *     ExportHelper.init({ chart: chart, mount: '#toolbar' });
 *   </script>
 */
(function (global) {
  'use strict';

  /** @type {{storageKey: string, exportPrefix: string, saveDebounceMs: number}} */
  const DEFAULTS = {
    storageKey: 'family-tree',
    exportPrefix: 'family-tree',
    saveDebounceMs: 400
  };

  const STYLES = `
    .eh-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 10px 14px;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .eh-toolbar button, .eh-toolbar label {
      padding: 7px 14px;
      border: 1px solid #c3cbd4;
      border-radius: 6px;
      background: #fff;
      color: #2c3138;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .eh-toolbar button:hover, .eh-toolbar label:hover { background: #eef2f6; }
    .eh-toolbar button.eh-primary { background: #039be5; border-color: #039be5; color: #fff; }
    .eh-toolbar button.eh-primary:hover { background: #0288c7; }
    .eh-toolbar input[type="file"] { display: none; }
    .eh-status { font-size: 13px; color: #8b949e; margin-left: auto; }
    .eh-status.eh-error { color: #ff6b6b; }
  `;

  /**
   * @typedef {Object} Person
   * @property {string} id
   * @property {{gender?: string, [key: string]: any}} data
   * @property {{parents?: string[], spouses?: string[], children?: string[]}} rels
   *
   * @typedef {Object} TreePayload
   * @property {number} version
   * @property {string} savedAt
   * @property {string|null} mainId
   * @property {Person[]} data
   */

  // ---------------------------------------------------------------------------
  // Module state - set once by init()
  // ---------------------------------------------------------------------------

  /** @type {any} */              let chart = null;
  /** @type {any} */              let editTree = null;
  /** @type {Object} */           let config = Object.assign({}, DEFAULTS);
  /** @type {HTMLElement|null} */ let statusEl = null;
  /** @type {number|undefined} */ let saveTimer;
  /** @type {string} */           let lastSaved = '';
  /** @type {((payload: {data: Person[], mainId: string|null}) => void)|null} */
  let onImport = null;

  // ---------------------------------------------------------------------------
  // Reading the tree
  // ---------------------------------------------------------------------------

  /**
   * The current people. editTree.exportData() is preferred when an edit form is
   * in play - it drops the half-finished node the user is still adding.
   * @returns {Person[]}
   */
  function getData() {
    try {
      if (editTree && typeof editTree.exportData === 'function') return editTree.exportData();
      if (chart && chart.store) return JSON.parse(JSON.stringify(chart.store.getData()));
    } catch (err) {
      console.warn('export_helper: could not read the tree:', err);
    }
    return [];
  }

  /** @returns {string|null} */
  function currentMainId() {
    if (!chart || typeof chart.getMainDatum !== 'function') return null;
    const datum = chart.getMainDatum();
    return datum ? String(datum.id) : null;
  }

  /** @returns {TreePayload} */
  function buildPayload() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      mainId: currentMainId(),
      data: getData()
    };
  }

  /**
   * The tree as pretty-printed JSON - the exact text exportToFile() downloads.
   * @returns {string}
   */
  function toJSON() {
    return JSON.stringify(buildPayload(), null, 2);
  }

  // ---------------------------------------------------------------------------
  // localStorage
  // ---------------------------------------------------------------------------

  /**
   * Writes the current tree to localStorage, skipping no-op writes.
   * @returns {boolean} whether anything was written
   */
  function store() {
    const payload = buildPayload();
    if (payload.data.length === 0) return false;   // mid-redraw, nothing to save

    // savedAt always differs, so compare only the meaningful part.
    const fingerprint = JSON.stringify([payload.mainId, payload.data]);
    if (fingerprint === lastSaved) return false;

    try {
      localStorage.setItem(config.storageKey, JSON.stringify(payload));
      lastSaved = fingerprint;
      // An autosave note must not wipe a warning the user has not read yet.
      if (!statusEl || !statusEl.classList.contains('eh-error')) {
        setStatus('Saved to this browser at ' + new Date().toLocaleTimeString());
      }
      return true;
    } catch (err) {
      setStatus('Could not save to browser storage: ' + err.message, true);
      return false;
    }
  }

  /** Debounced store(), for wiring to a change callback. @returns {void} */
  function storeSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(store, config.saveDebounceMs);
  }

  /**
   * Reads the saved tree back. Returns null when there is none or it is junk,
   * so the caller can fall back to its own starting data.
   * @returns {{data: Person[], mainId: string|null}|null}
   */
  function load() {
    let raw;
    try {
      raw = localStorage.getItem(config.storageKey);
    } catch (err) {
      return null;   // storage blocked
    }
    if (!raw) return null;
    try {
      return parse(raw);
    } catch (err) {
      console.warn('export_helper: ignoring unreadable saved tree:', err);
      return null;
    }
  }

  /** Forgets the saved tree. Does not touch what is on screen. @returns {void} */
  function clear() {
    try {
      localStorage.removeItem(config.storageKey);
      lastSaved = '';
      setStatus('Cleared the copy saved in this browser.');
    } catch (err) {
      setStatus('Could not clear browser storage: ' + err.message, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Parsing
  // ---------------------------------------------------------------------------

  /**
   * Accepts a bare array of people or a { data: [...] } payload.
   * @param {string} text
   * @returns {{data: Person[], mainId: string|null}}
   * @throws {Error} when the text is not a usable family tree
   */
  function parse(text) {
    const parsed = JSON.parse(text);
    const data = Array.isArray(parsed) ? parsed : parsed && parsed.data;

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('no family members found');
    }
    for (const person of data) {
      if (!person || typeof person !== 'object' || person.id == null) {
        throw new Error('every person needs an "id"');
      }
      if (!person.rels || typeof person.rels !== 'object') {
        throw new Error('every person needs a "rels" object');
      }
    }
    return {
      data: data,
      mainId: Array.isArray(parsed) || parsed.mainId == null ? null : String(parsed.mainId)
    };
  }

  // ---------------------------------------------------------------------------
  // Export / import
  // ---------------------------------------------------------------------------

  /**
   * Local timestamp for filenames, e.g. 20260829185500 (YYYYMMDDhhmmss).
   * @param {Date} [date]
   * @returns {string}
   */
  function fileTimestamp(date) {
    const d = date || new Date();
    const pad = n => String(n).padStart(2, '0');
    return String(d.getFullYear()) +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds());
  }

  /**
   * Downloads the current tree as a JSON file.
   * @returns {void}
   */
  function exportToFile() {
    const payload = buildPayload();
    if (payload.data.length === 0) {
      setStatus('Nothing to export yet.', true);
      return;
    }
    store();   // keep the file and the browser copy in sync

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = config.exportPrefix + '-' + fileTimestamp() + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatus('Exported ' + payload.data.length + ' family members.');
  }

  /**
   * Reads a JSON file and puts it on the chart.
   * @param {File} file
   * @returns {Promise<{data: Person[], mainId: string|null}>}
   */
  function importFromFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();

      reader.onload = function () {
        /** @type {{data: Person[], mainId: string|null}} */
        let payload;
        try {
          payload = parse(String(reader.result));
        } catch (err) {
          setStatus('Could not import "' + file.name + '": ' + err.message, true);
          reject(err);
          return;
        }
        apply(payload.data, payload.mainId);
        setStatus('Imported ' + payload.data.length + ' family members from ' + file.name + '.');
        resolve(payload);
      };
      reader.onerror = function () {
        setStatus('Could not read "' + file.name + '".', true);
        reject(new Error('could not read the file'));
      };
      reader.readAsText(file);
    });
  }

  /**
   * Swaps the chart's data for this one and redraws. This is the one place the
   * helper writes to the chart; pass an onImport callback to init() to take it
   * over yourself.
   *
   * @param {Person[]} data
   * @param {string|null} [mainId]
   * @returns {void}
   */
  function apply(data, mainId) {
    if (onImport) {
      onImport({ data: data, mainId: mainId == null ? null : String(mainId) });
      lastSaved = '';
      store();
      return;
    }
    if (!chart) {
      console.warn('export_helper: no chart to draw on; pass one to init()');
      return;
    }
    const people = JSON.parse(JSON.stringify(data));

    chart.updateData(people);
    const found = people.some(person => String(person.id) === String(mainId));
    chart.updateMainId(found ? String(mainId) : String(people[0].id));
    chart.updateTree({ initial: true });

    lastSaved = '';
    store();
  }

  /**
   * @param {Event} event
   * @returns {void}
   */
  function onFileSelected(event) {
    const input = /** @type {HTMLInputElement} */ (event.target);
    const file = input.files && input.files[0];
    if (file) importFromFile(file).catch(function () { /* status already shown */ });
    input.value = '';   // allow re-importing the same file
  }

  // ---------------------------------------------------------------------------
  // Optional toolbar
  // ---------------------------------------------------------------------------

  /**
   * Puts Save / Import / Clear buttons inside the given element. Entirely
   * optional - call the functions from your own UI instead if you prefer.
   *
   * @param {HTMLElement|string} target element or selector
   * @returns {HTMLElement|null} the toolbar
   */
  function mountToolbar(target) {
    let host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) {
      // Better a toolbar in the wrong place than no toolbar and no clue why.
      console.warn('export_helper: no "' + target + '" to mount in; using the top of <body>');
      host = document.body;
      if (!host) {
        console.error('export_helper: no <body> yet - call mountToolbar() after the page loads');
        return null;
      }
    }
    if (!document.getElementById('eh-styles')) {
      const style = document.createElement('style');
      style.id = 'eh-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'eh-toolbar';

    const saveBtn = createButton('Save to file', 'eh-primary');
    saveBtn.addEventListener('click', exportToFile);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'eh-file-input';
    fileInput.accept = 'application/json,.json';
    fileInput.addEventListener('change', onFileSelected);

    const importLabel = document.createElement('label');
    importLabel.htmlFor = fileInput.id;
    importLabel.textContent = 'Import from file';

    const clearBtn = createButton('Clear saved copy');
    clearBtn.addEventListener('click', function () {
      if (confirm('Forget the tree saved in this browser? The tree on screen stays.')) clear();
    });

    statusEl = document.createElement('span');
    statusEl.className = 'eh-status';
    statusEl.setAttribute('role', 'status');

    toolbar.append(saveBtn, importLabel, fileInput, clearBtn, statusEl);
    if (host === document.body) host.insertBefore(toolbar, host.firstChild);
    else host.appendChild(toolbar);
    return toolbar;
  }

  /**
   * Attaches (or swaps) the chart after the toolbar is already up, so the
   * buttons can be drawn before the chart exists.
   * @param {any} newChart
   * @param {any} [newEditTree]
   * @returns {Object} the helper, for chaining
   */
  function setChart(newChart, newEditTree) {
    chart = newChart || null;
    if (newEditTree !== undefined) editTree = newEditTree || null;
    if (editTree && typeof editTree.setOnChange === 'function') editTree.setOnChange(storeSoon);
    return api;
  }

  /**
   * @param {string} label
   * @param {string} [className]
   * @returns {HTMLButtonElement}
   */
  function createButton(label, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (className) button.className = className;
    return button;
  }

  /**
   * @param {string} message
   * @param {boolean} [isError]
   * @returns {void}
   */
  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('eh-error', !!isError);
  }

  // ---------------------------------------------------------------------------
  // Start-up
  // ---------------------------------------------------------------------------

  /**
   * @param {Object} options
   * @param {any} options.chart                    a chart from f3.createChart()
   * @param {any} [options.editTree]               chart.editTree(), when you have one
   * @param {string} [options.storageKey]
   * @param {string} [options.exportPrefix]        filename prefix for downloads
   * @param {number} [options.saveDebounceMs]
   * @param {HTMLElement|string} [options.mount]   where to put the toolbar
   * @param {HTMLElement|string} [options.status]  your own status element
   * @param {boolean} [options.autoSave]           save on edit and on page close
   * @param {(payload: {data: Person[], mainId: string|null}) => void} [options.onImport]
   * @returns {Object} the helper, for chaining
   */
  function init(options) {
    const opts = options || {};

    chart = opts.chart || null;
    editTree = opts.editTree || null;
    onImport = opts.onImport || null;

    config = Object.assign({}, DEFAULTS, {
      storageKey: opts.storageKey || DEFAULTS.storageKey,
      exportPrefix: opts.exportPrefix || DEFAULTS.exportPrefix,
      saveDebounceMs: opts.saveDebounceMs || DEFAULTS.saveDebounceMs
    });

    if (opts.status) {
      statusEl = typeof opts.status === 'string' ? document.querySelector(opts.status) : opts.status;
    }
    if (opts.mount) mountToolbar(opts.mount);

    if (opts.autoSave !== false) {
      window.addEventListener('beforeunload', store);
      // An edit form is the only thing that reports changes; a static chart has
      // nothing to hook, so its page saves when it wants to.
      if (editTree && typeof editTree.setOnChange === 'function') editTree.setOnChange(storeSoon);
    }
    return api;
  }

  const api = {
    init: init,
    setChart: setChart,
    getData: getData,
    toJSON: toJSON,
    store: store,
    storeSoon: storeSoon,
    load: load,
    clear: clear,
    parse: parse,
    apply: apply,
    exportToFile: exportToFile,
    importFromFile: importFromFile,
    mountToolbar: mountToolbar,
    setStatus: setStatus,
    get config() { return config; }
  };

  global.ExportHelper = api;
}(window));
