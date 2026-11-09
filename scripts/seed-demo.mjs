// Local demo data: `node scripts/seed-demo.mjs` (dev server on :4100 and `npm run db:up` running).
// Recreates demo@pocketplan.test / demo12345 with ~6 months of entries. Local Docker DB only, never Neon.
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:4100";
const EMAIL = "demo@pocketplan.test";
const PASSWORD = "demo12345";
const psql = (sql) =>
  execFileSync("docker", ["exec", "-i", "pocketplan-postgres", "psql", "-U", "pocketplan", "-d", "pocketplan", "-v", "ON_ERROR_STOP=1", "-tA"], { input: sql })
    .toString()
    .trim();
const q = (v) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

// 1. Fresh account through Better Auth so the password hash is real.
psql(`delete from "User" where email = ${q(EMAIL)};`);
const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Demo" }),
});
if (!res.ok) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
const uid = psql(`select id from "User" where email = ${q(EMAIL)};`);

// 2. Deterministic "random" so every run gives the same data.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (a) => a[Math.floor(rnd() * a.length)];
let n = 0;
const id = (p) => `demo_${p}_${++n}`;

const ENV = [
  // name, colour, target sen, monthly allocation sen, icon (Fun keeps the plain dot)
  ["Food", "#E07A5F", 90000, 90000, "utensils"],
  ["Transport", "#81B29A", 40000, 40000, "car"],
  ["Bills", "#3D405B", 150000, 150000, "receipt"],
  ["Fun", null, null, 30000, null],
  ["Savings", "#F2CC8F", 300000, 80000, "piggy-bank"],
];
const envId = Object.fromEntries(ENV.map(([name]) => [name, id("env")]));
const rows = [];
const tx = (t) => {
  const row = { id: id("tx"), voidedAt: null, correctsId: null, refundOfId: null, envelopeId: null, fromEnvelopeId: null, toEnvelopeId: null, merchant: null, note: null, recurringId: null, ...t };
  rows.push(row);
  return row;
};

const salaryRec = id("rec");
const phoneRec = id("rec");
tx({ type: "INCOME", amountSen: 200000, occurredOn: "2026-06-01", note: "Opening balance" });

const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const TODAY = "2026-11-09";
const FOOD = ["Nasi lemak", "Mamak", "Jaya Grocer", "Tealive", "KFC", "Chicken rice", "Lotus's"];
const TRANSPORT = ["Grab", "Petronas", "Touch 'n Go reload", "MRT"];
const FUN = ["GSC Cinema", "Shopee", "Steam", "Bowling"];

for (const m of MONTHS) {
  const last = m === "2026-11" ? 9 : 28;
  const day = (d) => `${m}-${String(Math.min(d, last)).padStart(2, "0")}`;
  tx({ type: "INCOME", amountSen: 420000, occurredOn: `${m}-01`, merchant: "Salary", recurringId: salaryRec });
  for (const [name, , , alloc] of ENV) tx({ type: "TRANSFER", amountSen: alloc, occurredOn: `${m}-01`, toEnvelopeId: envId[name] });

  // Spending stays under each month's allocation, so no envelope ever goes negative.
  let food = 0;
  for (let d = 2; d <= last; d += 1 + Math.floor(rnd() * 3)) {
    const amt = 800 + Math.floor(rnd() * 5200);
    if (food + amt > 82000) break;
    food += amt;
    tx({ type: "EXPENSE", amountSen: amt, occurredOn: day(d), envelopeId: envId.Food, merchant: pick(FOOD) });
  }
  let trans = 0;
  for (let d = 3; d <= last; d += 3 + Math.floor(rnd() * 4)) {
    const amt = 1200 + Math.floor(rnd() * 4800);
    if (trans + amt > 36000) break;
    trans += amt;
    tx({ type: "EXPENSE", amountSen: amt, occurredOn: day(d), envelopeId: envId.Transport, merchant: pick(TRANSPORT) });
  }
  if (last >= 3) tx({ type: "EXPENSE", amountSen: 18000 + Math.floor(rnd() * 9000), occurredOn: day(3), envelopeId: envId.Bills, merchant: "TNB" });
  if (m !== "2026-11") {
    tx({ type: "EXPENSE", amountSen: 12900, occurredOn: day(7), envelopeId: envId.Bills, merchant: "Unifi" });
    tx({ type: "EXPENSE", amountSen: 4800, occurredOn: day(5), envelopeId: envId.Bills, merchant: "Phone bill", recurringId: phoneRec });
    tx({ type: "EXPENSE", amountSen: 90000, occurredOn: day(10), envelopeId: envId.Bills, merchant: "Rent share" });
    tx({ type: "EXPENSE", amountSen: 4500 + Math.floor(rnd() * 8000), occurredOn: day(14), envelopeId: envId.Fun, merchant: pick(FUN) });
    tx({ type: "EXPENSE", amountSen: 3000 + Math.floor(rnd() * 6000), occurredOn: day(22), envelopeId: envId.Fun, merchant: pick(FUN) });
  }
}

// 3. One of each special case so every screen state has something to show.
const jacket = tx({ type: "EXPENSE", amountSen: 15000, occurredOn: "2026-10-18", envelopeId: envId.Fun, merchant: "Uniqlo", note: "Jacket" });
tx({ type: "REFUND", amountSen: 15000, occurredOn: "2026-10-24", envelopeId: envId.Fun, refundOfId: jacket.id, merchant: "Uniqlo", note: "Returned, wrong size" });
tx({ type: "TRANSFER", amountSen: 5000, occurredOn: "2026-09-20", fromEnvelopeId: envId.Fun, toEnvelopeId: envId.Transport, note: "Extra petrol" });
const typo = tx({ type: "EXPENSE", amountSen: 5800, occurredOn: "2026-11-06", envelopeId: envId.Food, merchant: "Jaya Grocer", voidedAt: "2026-11-06T12:00:00Z" });
tx({ type: "EXPENSE", amountSen: 8500, occurredOn: "2026-11-06", envelopeId: envId.Food, merchant: "Jaya Grocer", correctsId: typo.id, note: "Fixed amount" });
tx({ type: "EXPENSE", amountSen: 2500, occurredOn: "2026-11-04", envelopeId: envId.Fun, merchant: "Double tap", voidedAt: "2026-11-04T09:00:00Z" });
// Spending with no envelope: it comes straight out of Unallocated.
tx({ type: "EXPENSE", amountSen: 3500, occurredOn: "2026-10-12", merchant: "Pasar malam" });
tx({ type: "EXPENSE", amountSen: 12000, occurredOn: "2026-11-02", merchant: "Birthday gift", note: "For Mum" });
tx({ type: "EXPENSE", amountSen: 1590, occurredOn: "2026-11-08", merchant: "Parking" });

const cols = ["id", "userId", "type", "amountSen", "envelopeId", "fromEnvelopeId", "toEnvelopeId", "refundOfId", "occurredOn", "merchant", "note", "voidedAt", "correctsId", "recurringId"];
const sql = [
  "begin;",
  ...ENV.map(([name, colour, target, , icon], i) => `insert into "Envelope"(id,"userId",name,colour,icon,"targetSen","sortOrder") values (${[envId[name], uid, name, colour, icon, target, i].map(q).join(",")});`),
  // Salary: 6 occurrences handled, next due 1 Dec. Phone bill: 5 handled, so November's (5 Nov) shows as due.
  `insert into "RecurringItem"(id,"userId",kind,"amountSen",merchant,cadence,"startOn","handledCount") values (${[salaryRec, uid, "INCOME", 420000, "Salary", "MONTHLY", "2026-06-01", 6].map(q).join(",")});`,
  `insert into "RecurringItem"(id,"userId",kind,"amountSen","envelopeId",merchant,cadence,"startOn","handledCount") values (${[phoneRec, uid, "EXPENSE", 4800, envId.Bills, "Phone bill", "MONTHLY", "2026-06-05", 5].map(q).join(",")});`,
  ...rows.map((r) => `insert into "Transaction"(${cols.map((c) => `"${c}"`).join(",")}) values (${cols.map((c) => q(c === "userId" ? uid : r[c])).join(",")});`),
  `insert into "Preference"("userId",theme,mode,"updatedAt") values (${q(uid)},'modern','system',now()) on conflict ("userId") do nothing;`,
  "commit;",
].join("\n");
psql(sql);

// 4. Self-check: no envelope below zero, unallocated not negative (the invariant holds by construction: balances are derived).
const check = psql(`
  with t as (select * from "Transaction" where "userId" = ${q(uid)} and "voidedAt" is null),
  e as (
    select v.name,
      coalesce((select sum("amountSen") from t where "toEnvelopeId" = v.id), 0)
      - coalesce((select sum("amountSen") from t where "fromEnvelopeId" = v.id), 0)
      - coalesce((select sum("amountSen") from t where type = 'EXPENSE' and "envelopeId" = v.id), 0)
      + coalesce((select sum("amountSen") from t where type = 'REFUND' and "envelopeId" = v.id), 0) as bal
    from "Envelope" v where v."userId" = ${q(uid)})
  select string_agg(name || '=' || bal, ' ') || ' | unallocated=' ||
    ((select coalesce(sum("amountSen"),0) from t where type = 'INCOME')
     - (select coalesce(sum("amountSen"),0) from t where type = 'TRANSFER' and "fromEnvelopeId" is null)
     + (select coalesce(sum("amountSen"),0) from t where type = 'TRANSFER' and "toEnvelopeId" is null)
     - (select coalesce(sum("amountSen"),0) from t where type = 'EXPENSE' and "envelopeId" is null)
     + (select coalesce(sum("amountSen"),0) from t where type = 'REFUND' and "envelopeId" is null))
  from e;`);
console.log(`Seeded ${rows.length} entries for ${EMAIL} (today ${TODAY}). Balances in sen: ${check}`);
if (/=-\d/.test(check)) throw new Error("a balance went negative; adjust the seed");
console.log(`Sign in at ${BASE}/sign-in with ${EMAIL} / ${PASSWORD}`);
