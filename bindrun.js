// bindrun.js：按处理预算处理事件，用尽后整队列压账；收尾不限预算清账
import { pendOf, bindOf } from "./bind.js";

function code(spec, key, fallback) {
  const value = spec ? spec[key] : null;
  return typeof value === "string" && value ? value : fallback;
}

function fail(spec, key, fallback, message) {
  const error = new Error(message);
  error.code = code(spec, key, fallback);
  throw error;
}

function validateEvents(spec, events) {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)
        || (event.kind !== "def" && event.kind !== "use")) {
      fail(spec, "event_error_code", "E_BAD_EVENT", "事件结构不合法");
    }
    if (typeof event.name !== "string" || event.name === "") {
      fail(spec, "bad_name_code", "E_BAD_NAME", "名字不能为空");
    }
  }
}

function cloneState(state) {
  const source = state || {};
  const table = (rows) => (Array.isArray(rows) ? rows.map((row) => [row[0], row[1]]) : []);
  const ledger = (Array.isArray(source.ledger)
    ? source.ledger.map((row) => ({
        id: row && Object.prototype.hasOwnProperty.call(row, "id") ? row.id : null,
        kind: row.kind, name: row.name
      }))
    : []);
  return {
    defs: table(source.defs),
    resolved: table(source.resolved),
    pending: table(source.pending),
    ledger,
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

function applyEvent(state, event) {
  const defined = state.defs.some((row) => row[0] === event.name);
  if (event.kind === "def") {
    if (defined) {
      const error = new Error("同一个名字只能定义一次");
      error.code = state.dupCode;
      throw error;
    }
    const bound = bindOf(state.pending, state.resolved, event.name);
    state.pending = bound.pending;
    state.resolved = bound.resolved;
    let resolvedCount = 0;
    for (const row of state.resolved) {
      if (row[0] === event.name) { resolvedCount = row[1]; break; }
    }
    state.defs.push([event.name, resolvedCount]);
    state.defs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  } else if (defined) {
    let defRow = null;
    for (const row of state.defs) {
      if (row[0] === event.name) { defRow = row; break; }
    }
    defRow[1] += 1;
    const hit = state.resolved.some((row) => row[0] === event.name);
    state.resolved = hit
      ? state.resolved.map((row) => (row[0] === event.name ? [row[0], row[1] + 1] : row))
      : (() => { const next = state.resolved.concat([[event.name, 1]]);
                 next.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
                 return next; })();
  } else {
    state.pending = pendOf(state.pending, event.name);
  }
  if (event.id !== null && event.id !== undefined) state.applied.push(event.id);
}

export function step(spec) {
  const events = Array.isArray(spec.events) ? spec.events : [];
  validateEvents(spec, events);
  const state = cloneState(spec.state);
  state.dupCode = code(spec, "dup_def_code", "E_DUP_DEF");

  const queue = state.ledger
    .concat(events.map((event) => ({ id: event.id, kind: event.kind, name: event.name })));
  state.ledger = [];

  let budget = Number.isFinite(spec.budget) ? spec.budget : 0;
  let served = 0;
  for (const item of queue) {
    if (item.id !== null && item.id !== undefined && state.applied.includes(item.id)) continue;
    if (served >= budget) { state.ledger.push(item); continue; }
    applyEvent(state, item);
    served += 1;
  }

  return {
    state,
    served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map((row) => [row.kind, row.name]),
    judged: served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  state.dupCode = code(spec, "dup_def_code", "E_DUP_DEF");
  let catchup = 0;
  while (state.ledger.length) {
    const item = state.ledger.shift();
    applyEvent(state, item);
    catchup += 1;
  }
  return { state, catchup };
}
