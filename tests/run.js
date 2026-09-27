import assert from "node:assert";
import { pendOf, bindOf } from "../bind.js";
import { step, close } from "../bindrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { defs: [], resolved: [], pending: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "use", name: "a" }],
  bad_name_code: "E_BAD_NAME", dup_def_code: "E_DUP_DEF",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("pendOf returns a list", () => {
  assert.ok(Array.isArray(pendOf([], "a")));
});

check("bindOf returns both tables", () => {
  const got = bindOf([["a", 1]], [], "a");
  assert.ok(Array.isArray(got.pending) && Array.isArray(got.resolved));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
