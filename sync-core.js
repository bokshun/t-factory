/* StoreFlow sync core: safe pull/push, 3-way merge, and first-device protection.
   Pure logic with injected dependencies so it can be tested without a browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StoreFlowSyncCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const IGNORED_KEYS = ['syncedAt', 'appVersion', 'activeTimer'];
  const REALTIME_LIMIT_BYTES = 1024 * 1024; // Supabase Postgres Changes payload cap
  const WARN_BYTES = 800 * 1024;
  const MAX_PUSH_ATTEMPTS = 4;

  // Canonical JSON (sorted keys) because Postgres jsonb reorders object keys.
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().filter((k) => value[k] !== undefined)
        .map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
    }
    return JSON.stringify(value === undefined ? null : value);
  }
  const same = (a, b) => stable(a) === stable(b);

  function strip(state) {
    const copy = { ...state };
    IGNORED_KEYS.forEach((k) => delete copy[k]);
    return copy;
  }

  function isEmptyBoard(state) {
    const s = state || {};
    return ['tasks', 'messages', 'schedule'].every((k) => !Array.isArray(s[k]) || s[k].length === 0);
  }

  function itemKey(item) {
    return item && typeof item === 'object' && item.id != null ? 'id:' + item.id : 'json:' + stable(item);
  }

  function mergeArrays(base, local, remote) {
    const toMap = (arr) => new Map((arr || []).map((item) => [itemKey(item), item]));
    const b = toMap(base), l = toMap(local), r = toMap(remote);
    let conflicts = 0;
    const out = [];
    for (const [key, remoteItem] of r) {
      const inB = b.has(key), inL = l.has(key);
      const remoteChanged = inB && !same(remoteItem, b.get(key));
      if (inL) {
        const localItem = l.get(key);
        const localChanged = !inB || !same(localItem, b.get(key));
        if (localChanged && !same(localItem, remoteItem)) {
          if (remoteChanged) conflicts++;
          out.push(localItem);
        } else out.push(remoteItem);
      } else if (inB) {
        // deleted locally
        if (remoteChanged) { conflicts++; out.push(remoteItem); }
      } else out.push(remoteItem); // new on remote
    }
    for (const [key, localItem] of l) {
      if (r.has(key)) continue;
      const inB = b.has(key);
      if (inB) {
        // deleted remotely
        if (!same(localItem, b.get(key))) { conflicts++; out.push(localItem); }
      } else out.push(localItem); // new locally
    }
    return { items: out, conflicts };
  }

  function mergeStates(base, local, remote) {
    const B = strip(base || {}), L = strip(local || {}), R = strip(remote || {});
    const keys = [...new Set([...Object.keys(R), ...Object.keys(L)])];
    const merged = {};
    let conflicts = 0;
    for (const k of keys) {
      if ([B[k], L[k], R[k]].some(Array.isArray)) {
        const res = mergeArrays(B[k], L[k], R[k]);
        merged[k] = res.items;
        conflicts += res.conflicts;
      } else {
        const localChanged = !same(L[k], B[k]);
        const remoteChanged = !same(R[k], B[k]);
        if (localChanged && remoteChanged && !same(L[k], R[k])) conflicts++;
        merged[k] = localChanged ? L[k] : R[k];
      }
    }
    return { state: merged, conflicts };
  }

  /* deps: client (supabase-js-like), storeId, getState(), setState(obj),
     normalize(obj), loadMeta(), saveMeta(meta|null), backupLocal(state), onStatus(text) */
  function createEngine(deps) {
    const status = (t) => deps.onStatus && deps.onStatus(t);
    const table = () => deps.client.from('storeflow_sync');
    let pushing = false;

    function metaForStore() {
      const m = deps.loadMeta();
      return m && m.storeId === deps.storeId && typeof m.rev === 'number' ? m : null;
    }

    function adopt(row, kind) {
      const remote = deps.normalize(row.data);
      deps.setState(remote);
      deps.saveMeta({ storeId: deps.storeId, rev: row.rev, base: strip(deps.getState()) });
      return kind;
    }

    async function pull() {
      const { data: row, error } = await table().select('data, rev, updated_at')
        .eq('store_id', deps.storeId).maybeSingle();
      if (error) { status('Sync error'); return { result: 'error', error }; }
      if (!row || !row.data) { status('Cloud board is empty'); return { result: 'cloud-empty' }; }

      const meta = metaForStore();
      if (!meta) {
        deps.backupLocal(deps.getState());
        adopt(row);
        status('Joined team board');
        return { result: 'adopted' };
      }
      if (row.rev === meta.rev) { status('Up to date'); return { result: 'current' }; }
      if (row.rev < meta.rev) { status('Cloud older than this device; not applying'); return { result: 'stale-cloud' }; }

      const remote = deps.normalize(row.data);
      const local = deps.getState();
      const dirty = !same(strip(local), meta.base);
      if (!dirty) { adopt(row); status('Pulled latest'); return { result: 'updated' }; }

      const { state, conflicts } = mergeStates(meta.base, local, remote);
      deps.setState(state);
      // Base is the cloud version we merged on top of; local now holds extra changes to push.
      deps.saveMeta({ storeId: deps.storeId, rev: row.rev, base: strip(remote) });
      status(conflicts ? `Merged with ${conflicts} overlapping edit(s)` : 'Merged teammate changes');
      return { result: 'merged', conflicts, needsPush: true };
    }

    async function push() {
      if (pushing) return { result: 'busy' };
      pushing = true;
      try {
        for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt++) {
          const meta = metaForStore();
          if (!meta) { status('Pull the team board first'); return { result: 'needs-pull' }; }
          const local = deps.getState();
          if (isEmptyBoard(local)) { status('Not pushing an empty board'); return { result: 'refused-empty' }; }
          if (same(strip(local), meta.base)) { status('Up to date'); return { result: 'nothing-to-push' }; }
          const bytes = stable(local).length;
          if (bytes >= REALTIME_LIMIT_BYTES) status('Board is over 1 MB; live push may lag (polling covers it)');
          else if (bytes >= WARN_BYTES) status('Board is getting large');

          const { data: rows, error } = await table()
            .update({ data: local, updated_at: new Date().toISOString() })
            .eq('store_id', deps.storeId).eq('rev', meta.rev).select('rev');
          if (error) { status('Sync error'); return { result: 'error', error }; }
          if (rows && rows.length === 1) {
            deps.saveMeta({ storeId: deps.storeId, rev: rows[0].rev, base: strip(local) });
            status('Synced');
            return { result: 'pushed', rev: rows[0].rev };
          }
          // Someone else saved first: fetch, merge, retry.
          const pulled = await pull();
          if (pulled.result === 'error') return pulled;
        }
        status('Busy; will retry on next change');
        return { result: 'conflict-retry-exhausted' };
      } finally { pushing = false; }
    }

    // Explicit, user-confirmed. Insert only: can never replace an existing cloud board.
    async function initializeCloud() {
      const local = deps.getState();
      if (isEmptyBoard(local)) { status('Not starting a cloud board from an empty board'); return { result: 'refused-empty' }; }
      const { data: existing, error: readErr } = await table().select('rev').eq('store_id', deps.storeId).maybeSingle();
      if (readErr) { status('Sync error'); return { result: 'error', error: readErr }; }
      if (existing) { status('Cloud already has a board; pull instead'); return { result: 'cloud-exists' }; }
      const { data: rows, error } = await table().insert({ store_id: deps.storeId, data: local, updated_at: new Date().toISOString() }).select('rev');
      if (error) { status('Sync error'); return { result: 'error', error }; }
      deps.saveMeta({ storeId: deps.storeId, rev: rows[0].rev, base: strip(local) });
      status('Cloud board started');
      return { result: 'initialized', rev: rows[0].rev };
    }

    return { pull, push, initializeCloud, hasMeta: () => Boolean(metaForStore()) };
  }

  return { createEngine, mergeStates, mergeArrays, isEmptyBoard, stable, strip, REALTIME_LIMIT_BYTES, WARN_BYTES };
});
