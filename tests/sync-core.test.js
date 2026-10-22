// Run: node tests/sync-core.test.js   (no dependencies)
const assert = require('assert');
const core = require('../sync-core.js');

// ---- fake cloud table with rev counter and jsonb-style key reordering ----
function jsonbize(v) {
  if (Array.isArray(v)) return v.map(jsonbize);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).forEach((k) => { out[k] = jsonbize(v[k]); });
    return out;
  }
  return v;
}
function makeCloud() {
  const rows = new Map();
  const client = {
    from() {
      return {
        select(cols) {
          const f = {};
          const q = { eq(k, v) { f[k] = v; return q; },
            maybeSingle: async () => { const r = rows.get(f.store_id); return { data: r ? JSON.parse(JSON.stringify(r)) : null, error: null }; } };
          return q;
        },
        update(vals) {
          const f = {};
          const q = { eq(k, v) { f[k] = v; return q; },
            select: async () => {
              const r = rows.get(f.store_id);
              if (!r || r.rev !== f.rev) return { data: [], error: null };
              r.data = jsonbize(JSON.parse(JSON.stringify(vals.data))); r.rev += 1; r.updated_at = vals.updated_at;
              return { data: [{ rev: r.rev }], error: null };
            } };
          return q;
        },
        insert(vals) {
          return { select: async () => {
            if (rows.has(vals.store_id)) return { data: null, error: { message: 'duplicate key' } };
            rows.set(vals.store_id, { store_id: vals.store_id, data: jsonbize(JSON.parse(JSON.stringify(vals.data))), rev: 1 });
            return { data: [{ rev: 1 }], error: null };
          } };
        },
      };
    },
  };
  return { rows, client };
}

// ---- fake device ----
const normalize = (s) => ({ team: [{ id: 't1' }], tasks: [], messages: [], schedule: [], reminders: [], photos: [], ...s });
function makeDevice(cloud, name, initial, storeId = '19891-test') {
  const d = { name, state: normalize(initial), meta: null, backups: [], statuses: [] };
  d.engine = core.createEngine({
    client: cloud.client, storeId,
    getState: () => ({ ...d.state, activeTimer: null, syncedAt: 'x', appVersion: 'v' }),
    setState: (s) => { d.state = normalize(s); },
    normalize,
    loadMeta: () => d.meta, saveMeta: (m) => { d.meta = m ? JSON.parse(JSON.stringify(m)) : null; },
    backupLocal: (s) => d.backups.push(JSON.parse(JSON.stringify(s))),
    onStatus: (t) => d.statuses.push(t),
  });
  return d;
}
const board = (extra = {}) => ({ tasks: [{ id: 'task-1', title: 'Open store', status: 'todo' }], messages: [{ id: 'm1', body: 'hi' }], schedule: [{ id: 's1', name: 'Chris C.' }], ...extra });

let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n  ', e.message); process.exitCode = 1; } }

(async () => {
  await test('first-time device cannot push at all (no meta)', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board());
    const r = await a.engine.push();
    assert.strictEqual(r.result, 'needs-pull'); assert.strictEqual(cloud.rows.size, 0);
  });

  await test('empty cloud: pull does not upload; init is explicit and insert-only', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board());
    assert.strictEqual((await a.engine.pull()).result, 'cloud-empty'); assert.strictEqual(cloud.rows.size, 0);
    assert.strictEqual((await a.engine.initializeCloud()).result, 'initialized'); assert.strictEqual(cloud.rows.get('19891-test').rev, 1);
  });

  await test('empty board is never uploaded (init or push)', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', { tasks: [], messages: [], schedule: [] });
    assert.strictEqual((await a.engine.initializeCloud()).result, 'refused-empty'); assert.strictEqual(cloud.rows.size, 0);
  });

  await test('init cannot overwrite an existing cloud board', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    const b = makeDevice(cloud, 'B', board({ tasks: [{ id: 'other', title: 'Different' }] }));
    assert.strictEqual((await b.engine.initializeCloud()).result, 'cloud-exists');
    assert.strictEqual(cloud.rows.get('19891-test').data.tasks[0].id, 'task-1');
  });

  await test('new device with different local data adopts cloud, backs up local, never overwrites cloud', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    const before = JSON.stringify(cloud.rows.get('19891-test'));
    const b = makeDevice(cloud, 'B', { tasks: [{ id: 'b-local', title: 'B local' }], messages: [], schedule: [] });
    assert.strictEqual((await b.engine.push()).result, 'needs-pull');
    assert.strictEqual((await b.engine.pull()).result, 'adopted');
    assert.strictEqual(b.backups.length, 1); assert.strictEqual(b.backups[0].tasks[0].id, 'b-local');
    assert.strictEqual(b.state.tasks[0].id, 'task-1');
    assert.strictEqual((await b.engine.push()).result, 'nothing-to-push');
    assert.strictEqual(JSON.stringify(cloud.rows.get('19891-test')), before);
  });

  await test('jsonb key reordering causes no false changes', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board({ tasks: [{ id: 'task-1', title: 'Z', status: 'todo', priority: 'high', owner: 'Carlton R.' }] }));
    await a.engine.initializeCloud();
    const b = makeDevice(cloud, 'B', board()); await b.engine.pull();
    assert.strictEqual((await b.engine.pull()).result, 'current');
    assert.strictEqual((await b.engine.push()).result, 'nothing-to-push');
  });

  await test('simultaneous edits to DIFFERENT items both survive (task + message)', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    const b = makeDevice(cloud, 'B', board()); await b.engine.pull();
    a.state.tasks.push({ id: 'task-A', title: 'Chris assigns task' });
    b.state.messages.push({ id: 'm-B', body: 'Margarette message' });
    assert.strictEqual((await a.engine.push()).result, 'pushed');
    const rb = await b.engine.push();
    assert.strictEqual(rb.result, 'pushed');
    const final = cloud.rows.get('19891-test').data;
    assert.ok(final.tasks.some((t) => t.id === 'task-A'), 'task from A kept');
    assert.ok(final.messages.some((m) => m.id === 'm-B'), 'message from B kept');
    await a.engine.pull();
    assert.ok(a.state.messages.some((m) => m.id === 'm-B') && a.state.tasks.some((t) => t.id === 'task-A'));
    assert.strictEqual(final.messages.length, 2);
  });

  await test('three-way: concurrent edits to the same task are reported as overlap, newest pusher wins, nothing else lost', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    const b = makeDevice(cloud, 'B', board()); await b.engine.pull();
    a.state.tasks[0] = { ...a.state.tasks[0], status: 'done' };
    b.state.tasks[0] = { ...b.state.tasks[0], status: 'in-progress' };
    b.state.messages.push({ id: 'm-B', body: 'extra' });
    await a.engine.push(); await b.engine.push();
    const final = cloud.rows.get('19891-test').data;
    assert.strictEqual(final.tasks.find((t) => t.id === 'task-1').status, 'in-progress');
    assert.ok(final.messages.some((m) => m.id === 'm-B'));
    assert.ok(b.statuses.some((s) => /overlapping/.test(s)));
  });

  await test('delete on one device and unrelated add on another both apply', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    const b = makeDevice(cloud, 'B', board()); await b.engine.pull();
    a.state.messages = []; b.state.tasks.push({ id: 'task-B', title: 'new' });
    await a.engine.push(); await b.engine.push();
    const final = cloud.rows.get('19891-test').data;
    assert.strictEqual(final.messages.length, 0); assert.ok(final.tasks.some((t) => t.id === 'task-B'));
  });

  await test('edit beats a concurrent delete (edit preserved)', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    const b = makeDevice(cloud, 'B', board()); await b.engine.pull();
    a.state.tasks = []; b.state.tasks[0] = { ...b.state.tasks[0], status: 'done' };
    await a.engine.push(); await b.engine.push();
    assert.strictEqual(cloud.rows.get('19891-test').data.tasks[0].status, 'done');
  });

  await test('pull with unpushed local edits merges instead of replacing', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    const b = makeDevice(cloud, 'B', board()); await b.engine.pull();
    a.state.tasks.push({ id: 'task-A' }); await a.engine.push();
    b.state.messages.push({ id: 'm-B' });
    const r = await b.engine.pull();
    assert.strictEqual(r.result, 'merged'); assert.ok(b.state.tasks.some((t) => t.id === 'task-A') && b.state.messages.some((m) => m.id === 'm-B'));
  });

  await test('stale cloud (older rev) never replaces newer local data', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    a.state.tasks.push({ id: 'x' }); await a.engine.push();
    cloud.rows.get('19891-test').rev = 1; // simulate restored/older replica
    assert.strictEqual((await a.engine.pull()).result, 'stale-cloud');
    assert.ok(a.state.tasks.some((t) => t.id === 'x'));
  });

  await test('meta from a different store ID is ignored (treated as first-time)', async () => {
    const cloud = makeCloud(); const a = makeDevice(cloud, 'A', board()); await a.engine.initializeCloud();
    const c = makeDevice(cloud, 'C', board(), 'store-19891'); c.meta = { storeId: '19891-test', rev: 1, base: {} };
    assert.strictEqual((await c.engine.push()).result, 'needs-pull');
  });

  await test('unit: mergeStates scalar and array rules', () => {
    const base = { tasks: [{ id: 1, v: 0 }], planningEvent: { n: 1 } };
    const r = core.mergeStates(base, { tasks: [{ id: 1, v: 0 }, { id: 2 }], planningEvent: { n: 1 } }, { tasks: [{ id: 1, v: 5 }], planningEvent: { n: 2 } });
    assert.deepStrictEqual(r.state.tasks.map((t) => t.id), [1, 2]); assert.strictEqual(r.state.tasks[0].v, 5); assert.strictEqual(r.state.planningEvent.n, 2); assert.strictEqual(r.conflicts, 0);
  });

  console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
})();
