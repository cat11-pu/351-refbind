// bind.js：前向引用挂账，定义到来时把同批未决引用整批转判

function findRow(table, name) {
  for (const row of table) {
    if (row[0] === name) return row;
  }
  return null;
}

function insertPosition(table, name) {
  let lo = 0;
  let hi = table.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table[mid][0] < name) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function pendOf(pending, name) {
  const next = pending.map((row) => [row[0], row[1]]);
  const existing = findRow(next, name);
  if (existing) {
    existing[1] += 1;
    return next;
  }
  next.splice(insertPosition(next, name), 0, [name, 1]);
  return next;
}

export function bindOf(pending, resolved, name) {
  const waiting = findRow(pending, name);
  const nextPending = pending
    .filter((row) => row[0] !== name)
    .map((row) => [row[0], row[1]]);
  const nextResolved = resolved.map((row) => [row[0], row[1]]);
  if (waiting) {
    const hit = findRow(nextResolved, name);
    if (hit) hit[1] += waiting[1];
    else nextResolved.splice(insertPosition(nextResolved, name), 0, [name, waiting[1]]);
  }
  return { pending: nextPending, resolved: nextResolved };
}
