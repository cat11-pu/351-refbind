// bindrun.js：按处理预算处理事件，用尽后连着载压账带出下一轮；收尾不限预算。
import { pendOf, bindOf } from "./bind.js";

function cloneState(state) {
  const s = state || {};
  return {
    defs: (s.defs || []).map(function (row) { return [row[0], row[1]]; }),
    resolved: (s.resolved || []).map(function (row) { return [row[0], row[1]]; }),
    pending: (s.pending || []).map(function (row) { return [row[0], row[1]]; }),
    ledger: (s.ledger || []).map(function (row) { return row.slice(); }),
    applied: (s.applied || []).slice()
  };
}

function sortRows(rows) {
  return rows.sort(function (a, b) {
    return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);
  });
}

function validate(events, spec) {
  const badEventCode = spec.event_error_code || "E_BAD_EVENT";
  const badNameCode = spec.bad_name_code || "E_BAD_NAME";
  (events || []).forEach(function (event) {
    if (!event || typeof event !== "object"
        || (event.kind !== "def" && event.kind !== "use")) {
      const error = new Error("非法事件");
      error.code = badEventCode;
      throw error;
    }
    if (typeof event.name !== "string" || event.name.length === 0) {
      const error = new Error("名字不能为空");
      error.code = badNameCode;
      throw error;
    }
  });
}

function bumpResolved(resolved, name) {
  const row = resolved.find(function (item) { return item[0] === name; });
  const next = resolved.filter(function (item) { return item[0] !== name; });
  next.push([name, (row ? row[1] : 0) + 1]);
  return sortRows(next);
}

function applyEvent(state, event, spec) {
  if (event.kind === "use") {
    if (state.defs.some(function (row) { return row[0] === event.name; })) {
      state.resolved = bumpResolved(state.resolved, event.name);
      state.defs = sortRows(state.defs.map(function (row) {
        return row[0] === event.name ? [row[0], row[1] + 1] : row;
      }));
    } else {
      state.pending = pendOf(state.pending, event.name);
    }
    return;
  }
  if (state.defs.some(function (row) { return row[0] === event.name; })) {
    const error = new Error("名字重复定义：" + event.name);
    error.code = spec.dup_def_code || "E_DUP_DEF";
    throw error;
  }
  const moved = bindOf(state.pending, state.resolved, event.name);
  state.pending = moved.pending;
  state.resolved = moved.resolved;
  const held = moved.resolved.find(function (row) { return row[0] === event.name; });
  state.defs.push([event.name, held ? held[1] : 0]);
  state.defs = sortRows(state.defs);
}

// 处理一条队列：已有账目先处理，再处理本轮事件；返回该步后的新状态与计数。
function run(spec, unlimited) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  validate(events, spec);

  // 账目里存的是 [id, kind, name]，是上一轮没处理完事件“连着载压账”的化身；
  // 同一 id 再出现在本轮事件里时只算一条（账目优先），无 id 的条目无法归并。
  const queue = [];
  const queuedIds = Object.create(null);
  state.ledger.forEach(function (row) {
    queue.push({ id: row[0], kind: row[1], name: row[2] });
    if (row[0] !== undefined && row[0] !== null) { queuedIds[String(row[0])] = true; }
  });
  events.forEach(function (event) {
    if (event.id !== undefined && event.id !== null && queuedIds[String(event.id)]) { return; }
    queue.push({ id: event.id, kind: event.kind, name: event.name });
    if (event.id !== undefined && event.id !== null) { queuedIds[String(event.id)] = true; }
  });

  // 重放时已处理集合里的条目不占预算、不再处理，也不会重新压账。
  const pendingWork = queue.filter(function (item) {
    return item.id === undefined || state.applied.indexOf(item.id) === -1;
  });

  let budget = unlimited ? pendingWork.length : Math.max(0, Number(spec.budget) || 0);
  let served = 0;
  for (const item of pendingWork) {
    if (served >= budget) {
      state.ledger = pendingWork.slice(served).map(function (left) {
        return [left.id, left.kind, left.name];
      });
      return { state: state, served: served };
    }
    applyEvent(state, item, spec);
    if (item.id !== undefined) { state.applied.push(item.id); }
    served += 1;
  }
  state.ledger = [];
  return { state: state, served: served };
}

export function step(spec) {
  const events = spec.events || [];
  const ran = run(spec, false);
  return {
    state: ran.state,
    served: ran.served,
    ledger_before: ran.state.ledger.length,
    ledger: ran.state.ledger.map(function (row) { return [row[1], row[2]]; }),
    judged: ran.served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const ran = run(spec, true);
  return { state: ran.state, catchup: ran.served };
}
