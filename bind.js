// bind.js：引用归并与定义切换（基线：一律原样返回）
export function pendOf(pending, name) {
  return pending;
}

export function bindOf(pending, resolved, name) {
  return { pending: pending, resolved: resolved };
}
