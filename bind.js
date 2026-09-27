// bind.js：引用归并与定义切换（名字升序）
function sorted(rows) {
  return rows.slice().sort(function (a, b) {
    return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);
  });
}

function bump(rows, name, delta) {
  const next = rows.filter(function (row) { return row[0] !== name; });
  const before = rows.find(function (row) { return row[0] === name; });
  next.push([name, (before ? before[1] : 0) + delta]);
  return sorted(next);
}

// 未决表里这个名字的引用次数加一（没有就先建），保持名字升序。
export function pendOf(pending, name) {
  return bump(pending, name, 1);
}

// 定义到来：把未决表里这个名字的次数整批转进已解析表，
// 未决表去掉这条，两边保持名字升序。
export function bindOf(pending, resolved, name) {
  const held = pending.find(function (row) { return row[0] === name; });
  return {
    pending: pending.filter(function (row) { return row[0] !== name; }),
    resolved: held ? bump(resolved, name, held[1]) : sorted(resolved)
  };
}
