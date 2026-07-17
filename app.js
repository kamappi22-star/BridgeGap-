const { useState, useEffect, useMemo } = React;

// ---- Design tokens ----
// Background: warm ivory ledger paper (#F6F2E7) | Primary: deep forest green (#1B3B2F)
// Accent: brass/gold (#B8863B) | Ink: navy-charcoal (#26313B) | Warning: brick coral (#C0533E)

const CATEGORY_PRESETS = [
  "Food & Groceries", "Transport", "Rent/Utilities", "School Fees",
  "Church & Community", "Health", "Savings Transfer", "Other",
];
const ACCOUNT_TYPES = ["Cash", "Mobile Money", "Bank", "Savings", "Other"];
const CHART_COLORS = ["#1B3B2F", "#B8863B", "#C0533E", "#5B7065", "#8C6D46", "#4A6670", "#9A8F6B"];

function currency(n) {
  const v = Number(n) || 0;
  return "GHS " + v.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function signedCurrency(n) {
  const v = Number(n) || 0;
  return (v >= 0 ? "+" : "") + currency(v);
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function nowLocalDatetime() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function ym(dateStr) { return dateStr.slice(0, 7); }
function monthLabel(year, month) { return new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" }); }
function shiftMonth(year, month, delta) { const d = new Date(year, month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() }; }
function monthsElapsed(createdAt, year, month) {
  const start = new Date(createdAt);
  const count = (year - start.getFullYear()) * 12 + (month - start.getMonth()) + 1;
  return Math.max(count, 0);
}
function emptyLedger() { return { categories: [], expenses: [], goals: [], accounts: [] }; }
function normalize(parsed) {
  return {
    categories: (parsed.categories || []).map((c) => ({ createdAt: nowLocalDatetime(), ...c })),
    expenses: parsed.expenses || [],
    goals: parsed.goals || [],
    accounts: parsed.accounts || [],
  };
}

// ---------- Firestore-backed ledger hook ----------
function useLedgerFirestore(docPath) {
  const [data, setDataState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!docPath) return;
    const { db, doc, onSnapshot } = window.__fb;
    const ref = doc(db, "ledgers", docPath);
    const unsub = onSnapshot(
      ref,
      (snap) => { setDataState(snap.exists() ? normalize(snap.data()) : emptyLedger()); setLoading(false); },
      () => { setError("Sync error — check your connection."); setLoading(false); }
    );
    return () => unsub();
  }, [docPath]);

  const save = async (next) => {
    setDataState(next);
    try {
      const { db, doc, setDoc } = window.__fb;
      await setDoc(doc(db, "ledgers", docPath), next);
      setError(null);
    } catch (e) {
      setError("Couldn't save — check your connection.");
    }
  };
  return { data, setData: save, loading, error };
}

// ---------- Small building blocks ----------
function StampBadge({ label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: "2px solid #B8863B", color: "#B8863B", borderRadius: 999, padding: "2px 10px",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      transform: "rotate(-4deg)", fontFamily: "Georgia, serif",
    }}>{label}</span>
  );
}
function ProgressBar({ pct, danger }) {
  return (
    <div style={{ background: "#E5DFCE", borderRadius: 999, height: 8, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, height: "100%", background: danger ? "#C0533E" : "#1B3B2F", transition: "width 0.4s ease", borderRadius: 999 }} />
    </div>
  );
}
function Section({ title, icon, children, action }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: "#1B3B2F", margin: 0 }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const formWrapStyle = { display: "flex", flexDirection: "column", gap: 8, background: "#FFFDF8", border: "1px solid #E5DFCE", borderRadius: 10, padding: 12, marginBottom: 12 };
const inputStyle = { border: "1px solid #D8D0B8", borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: "inherit", background: "#fff", color: "#26313B", outline: "none" };
const primaryBtnStyle = { flex: 1, background: "#1B3B2F", color: "#F6F2E7", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const ghostBtnStyle = { background: "transparent", color: "#6B7280", border: "1px solid #D8D0B8", borderRadius: 8, padding: "10px 14px", fontSize: 14, cursor: "pointer" };
function iconBtnStyle() { return { display: "inline-flex", alignItems: "center", gap: 4, background: "#EFE9D8", color: "#1B3B2F", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }; }
function AccountBadge({ label }) {
  return <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8C6D46", background: "#F1E9D3", borderRadius: 5, padding: "2px 6px" }}>{label}</span>;
}

// ---------- Forms ----------
function AddAccountForm({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [type, setType] = useState(ACCOUNT_TYPES[0]);
  const [balance, setBalance] = useState("");
  return (
    <div style={formWrapStyle}>
      <input placeholder="Account name (e.g. MTN MoMo)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>{ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      <input placeholder="Starting balance (GHS)" type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} style={inputStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { if (!name) return; onAdd({ id: uid(), name, type, balance: Number(balance) || 0 }); onClose(); }} style={primaryBtnStyle}>Add account</button>
        <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
      </div>
    </div>
  );
}
function AddCategoryForm({ onAdd, onClose }) {
  const [name, setName] = useState(CATEGORY_PRESETS[0]);
  const [customName, setCustomName] = useState("");
  const [budget, setBudget] = useState("");
  const finalName = name === "Other" && customName ? customName : name;
  return (
    <div style={formWrapStyle}>
      <select value={name} onChange={(e) => setName(e.target.value)} style={inputStyle}>{CATEGORY_PRESETS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      {name === "Other" && <input placeholder="Category name" value={customName} onChange={(e) => setCustomName(e.target.value)} style={inputStyle} />}
      <input placeholder="Monthly budget (GHS)" type="number" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} style={inputStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { if (!finalName || !budget) return; onAdd({ id: uid(), name: finalName, budget: Number(budget), createdAt: nowLocalDatetime() }); onClose(); }} style={primaryBtnStyle}>Add category</button>
        <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
      </div>
    </div>
  );
}
function AddExpenseForm({ categories, accounts, onAdd, onClose }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]?.name || "");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(nowLocalDatetime());
  return (
    <div style={formWrapStyle}>
      <input placeholder="Amount (GHS)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} autoFocus />
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
        {categories.length === 0 && <option value="">Add a category first</option>}
        {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
      </select>
      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
        {accounts.length === 0 && <option value="">Add an account first</option>}
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({currency(a.balance)})</option>)}
      </select>
      <input placeholder="Description (e.g. Market — tomatoes & rice)" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={inputStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { if (!amount || !category || !accountId) return; onAdd({ id: uid(), amount: Number(amount), category, accountId, note, date: when }); onClose(); }} style={primaryBtnStyle} disabled={categories.length === 0 || accounts.length === 0}>Log expense</button>
        <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
      </div>
    </div>
  );
}
function AddGoalForm({ accounts, onAdd, onClose }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const savingsAccounts = accounts.filter((a) => a.type === "Savings");
  const [accountId, setAccountId] = useState(savingsAccounts[0]?.id || "");
  return (
    <div style={formWrapStyle}>
      <input placeholder="Goal name (e.g. Emergency fund)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <input placeholder="Target amount (GHS)" type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle} />
      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
        <option value="">No linked savings account</option>
        {savingsAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { if (!name || !target) return; onAdd({ id: uid(), name, target: Number(target), saved: 0, accountId: accountId || null }); onClose(); }} style={primaryBtnStyle}>Create goal</button>
        <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
      </div>
    </div>
  );
}
function ContributeForm({ accounts, onContribute, onClose }) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  return (
    <div style={{ ...formWrapStyle, marginTop: 8, marginBottom: 0 }}>
      <input placeholder="Amount (GHS)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} autoFocus />
      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
        {accounts.length === 0 && <option value="">No accounts yet</option>}
        {accounts.map((a) => <option key={a.id} value={a.id}>From {a.name} ({currency(a.balance)})</option>)}
      </select>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { const n = Number(amount); if (!n || n <= 0 || !accountId) return; onContribute(n, accountId); onClose(); }} style={primaryBtnStyle}>Add savings</button>
        <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
      </div>
    </div>
  );
}

// ---------- Dependency-free charts (CSS conic-gradient + simple bars) ----------
function ChartCard({ title, children }) {
  return (
    <div style={{ background: "#FFFDF8", border: "1px solid #E5DFCE", borderRadius: 10, padding: "12px 10px", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#26313B", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function ExpensePieCSS({ categories, spentThisMonthByCategory }) {
  const chartData = categories.map((c, i) => ({ name: c.name, value: spentThisMonthByCategory[c.name] || 0, color: CHART_COLORS[i % CHART_COLORS.length] })).filter((d) => d.value > 0);
  if (chartData.length === 0) return <p style={{ color: "#8A8370", fontSize: 13 }}>No spending logged this month yet.</p>;
  const total = chartData.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const stops = chartData.map((d) => {
    const start = (acc / total) * 100;
    acc += d.value;
    const end = (acc / total) * 100;
    return `${d.color} ${start}% ${end}%`;
  }).join(", ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 110, height: 110, borderRadius: "50%", flexShrink: 0,
        background: `conic-gradient(${stops})`, position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 22, background: "#FFFDF8", borderRadius: "50%" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        {chartData.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.color, display: "inline-block" }} />
            <span style={{ color: "#26313B" }}>{d.name}</span>
            <span style={{ color: "#8A8370" }}>{currency(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function BudgetVsSpentBars({ rows }) {
  if (rows.length === 0) return <p style={{ color: "#8A8370", fontSize: 13 }}>Add a category to compare budget vs spend.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => {
        const max = Math.max(r.effectiveBudget, r.spentThisMonth, 1);
        return (
          <div key={r.id}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#26313B", marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span>{currency(r.spentThisMonth)} / {currency(r.effectiveBudget)}</span>
            </div>
            <div style={{ height: 7, background: "#E5DFCE", borderRadius: 999, marginBottom: 3, overflow: "hidden" }}>
              <div style={{ width: `${(r.effectiveBudget / max) * 100}%`, height: "100%", background: "#D8D0B8" }} />
            </div>
            <div style={{ height: 7, background: "#E5DFCE", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${(r.spentThisMonth / max) * 100}%`, height: "100%", background: r.spentThisMonth > r.effectiveBudget ? "#C0533E" : "#1B3B2F" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
function GoalsBars({ goals }) {
  if (goals.length === 0) return <p style={{ color: "#8A8370", fontSize: 13 }}>Create a savings goal to see progress here.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {goals.map((g) => {
        const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
        return (
          <div key={g.id}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#26313B", marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>{g.name}</span>
              <span>{currency(g.saved)} / {currency(g.target)}</span>
            </div>
            <ProgressBar pct={pct} />
          </div>
        );
      })}
    </div>
  );
}

// ---------- Excel export ----------
function exportMonthToExcel({ label, view, categoryRows, expensesThisMonth, accounts, goals, totalEffectiveBudget, totalSpentThisMonth, totalCarryForward }) {
  const monthText = monthLabel(view.year, view.month);
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    [`${label} Ledger — ${monthText}`], [],
    ["Total spent this month", totalSpentThisMonth],
    ["Total available (incl. carry-forward)", totalEffectiveBudget],
    ["Remaining", Math.max(totalEffectiveBudget - totalSpentThisMonth, 0)],
    ["Carried in from previous months", totalCarryForward], [],
    ["Category", "Budget (base)", "Carried forward", "Available this month", "Spent this month", "Remaining"],
    ...categoryRows.map((c) => [c.name, c.budget, c.carryForward, c.effectiveBudget, c.spentThisMonth, c.effectiveBudget - c.spentThisMonth]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const txRows = [
    ["Date", "Time", "Category", "Description", "Account", "Amount (GHS)"],
    ...expensesThisMonth.map((e) => [e.date.slice(0, 10), e.date.slice(11, 16), e.category, e.note || "", accounts.find((a) => a.id === e.accountId)?.name || "Deleted account", e.amount]),
  ];
  const txSheet = XLSX.utils.aoa_to_sheet(txRows);
  txSheet["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 32 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, txSheet, "Transactions");

  const accRows = [["Account", "Type", "Balance (GHS)"], ...accounts.map((a) => [a.name, a.type, a.balance])];
  const accSheet = XLSX.utils.aoa_to_sheet(accRows);
  accSheet["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, accSheet, "Accounts");

  const goalRows = [
    ["Goal", "Saved (GHS)", "Target (GHS)", "Remaining (GHS)", "% Complete", "Linked account"],
    ...goals.map((g) => [g.name, g.saved, g.target, Math.max(g.target - g.saved, 0), g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0, accounts.find((a) => a.id === g.accountId)?.name || ""]),
  ];
  const goalSheet = XLSX.utils.aoa_to_sheet(goalRows);
  goalSheet["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, goalSheet, "Savings Goals");

  const chartRows = [
    ["-- Select this table, then Insert > Recommended Charts, for a category spend chart --"],
    ["Category", "Budget available", "Spent"],
    ...categoryRows.map((c) => [c.name, c.effectiveBudget, c.spentThisMonth]), [],
    ["-- Select this table for a savings goals chart --"],
    ["Goal", "Saved", "Remaining"],
    ...goals.map((g) => [g.name, g.saved, Math.max(g.target - g.saved, 0)]),
  ];
  const chartSheet = XLSX.utils.aoa_to_sheet(chartRows);
  chartSheet["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, chartSheet, "Chart Data");

  XLSX.writeFile(wb, `${label}-Ledger-${view.year}-${String(view.month + 1).padStart(2, "0")}.xlsx`);
}

// ---------- Ledger ----------
function Ledger({ docPath, label }) {
  const { data, setData, loading, error } = useLedgerFirestore(docPath);
  const [showCatForm, setShowCatForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showAccForm, setShowAccForm] = useState(false);
  const [contributingGoalId, setContributingGoalId] = useState(null);

  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const viewKey = `${view.year}-${String(view.month + 1).padStart(2, "0")}`;
  const prior = shiftMonth(view.year, view.month, -1);

  const categoryRows = useMemo(() => {
    if (!data) return [];
    return data.categories.map((c) => {
      const expForCat = data.expenses.filter((e) => e.category === c.name);
      const spentThisMonth = expForCat.filter((e) => ym(e.date) === viewKey).reduce((s, e) => s + e.amount, 0);
      const monthsThroughPrior = monthsElapsed(c.createdAt, prior.year, prior.month);
      const cumulativeBudgetThroughPrior = c.budget * monthsThroughPrior;
      const priorKeyEnd = `${prior.year}-${String(prior.month + 1).padStart(2, "0")}`;
      const cumulativeSpentThroughPrior = expForCat.filter((e) => ym(e.date) <= priorKeyEnd).reduce((s, e) => s + e.amount, 0);
      const carryForward = monthsThroughPrior > 0 ? cumulativeBudgetThroughPrior - cumulativeSpentThroughPrior : 0;
      return { ...c, spentThisMonth, carryForward, effectiveBudget: c.budget + carryForward };
    });
  }, [data, viewKey, prior.year, prior.month]);

  const spentThisMonthByCategory = useMemo(() => { const m = {}; for (const r of categoryRows) m[r.name] = r.spentThisMonth; return m; }, [categoryRows]);
  const expensesThisMonth = useMemo(() => (data ? data.expenses.filter((e) => ym(e.date) === viewKey).sort((a, b) => b.date.localeCompare(a.date)) : []), [data, viewKey]);
  const groupedByDay = useMemo(() => {
    const groups = {};
    for (const e of expensesThisMonth) { const day = e.date.slice(0, 10); (groups[day] = groups[day] || []).push(e); }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expensesThisMonth]);

  const totalEffectiveBudget = categoryRows.reduce((s, r) => s + r.effectiveBudget, 0);
  const totalSpentThisMonth = categoryRows.reduce((s, r) => s + r.spentThisMonth, 0);
  const totalCarryForward = categoryRows.reduce((s, r) => s + r.carryForward, 0);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Loading {label.toLowerCase()} ledger…</div>;

  const accountName = (id) => data.accounts.find((a) => a.id === id)?.name || "Deleted account";
  const removeExpense = (id) => {
    const exp = data.expenses.find((e) => e.id === id);
    const accounts = exp ? data.accounts.map((a) => (a.id === exp.accountId ? { ...a, balance: a.balance + exp.amount } : a)) : data.accounts;
    setData({ ...data, expenses: data.expenses.filter((e) => e.id !== id), accounts });
  };
  const removeCategory = (id) => {
    const cat = data.categories.find((c) => c.id === id);
    setData({ ...data, categories: data.categories.filter((c) => c.id !== id), expenses: data.expenses.filter((e) => e.category !== cat?.name) });
  };
  const removeGoal = (id) => setData({ ...data, goals: data.goals.filter((g) => g.id !== id) });
  const removeAccount = (id) => setData({ ...data, accounts: data.accounts.filter((a) => a.id !== id) });
  const addExpense = (e) => setData({ ...data, expenses: [e, ...data.expenses], accounts: data.accounts.map((a) => (a.id === e.accountId ? { ...a, balance: a.balance - e.amount } : a)) });
  const contributeToGoal = (goalId, amt, sourceAccountId) => {
    const goal = data.goals.find((g) => g.id === goalId);
    setData({
      ...data,
      goals: data.goals.map((g) => (g.id === goalId ? { ...g, saved: g.saved + amt } : g)),
      accounts: data.accounts.map((a) => {
        if (a.id === sourceAccountId) return { ...a, balance: a.balance - amt };
        if (goal?.accountId && a.id === goal.accountId) return { ...a, balance: a.balance + amt };
        return a;
      }),
    });
  };

  return (
    <div>
      {error && <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FBEAE6", color: "#C0533E", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => setView(shiftMonth(view.year, view.month, -1))} style={{ ...iconBtnStyle(), padding: "6px 10px" }}>‹</button>
        <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, color: "#1B3B2F", fontSize: 15 }}>{monthLabel(view.year, view.month)}</div>
        <button onClick={() => setView(shiftMonth(view.year, view.month, 1))} style={{ ...iconBtnStyle(), padding: "6px 10px" }}>›</button>
      </div>

      <button
        onClick={() => exportMonthToExcel({ label, view, categoryRows, expensesThisMonth, accounts: data.accounts, goals: data.goals, totalEffectiveBudget, totalSpentThisMonth, totalCarryForward })}
        style={{ ...iconBtnStyle(), width: "100%", justifyContent: "center", padding: "10px 0", marginBottom: 16 }}
      >⬇ Export {monthLabel(view.year, view.month)} to Excel</button>

      <div style={{ background: "#1B3B2F", borderRadius: 14, padding: "18px 20px", color: "#F6F2E7", marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.75, marginBottom: 6 }}>{label} — {monthLabel(view.year, view.month)}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 24, fontWeight: 700 }}>{currency(totalSpentThisMonth)}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>spent of {currency(totalEffectiveBudget)} available</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 16, color: totalSpentThisMonth > totalEffectiveBudget ? "#E8A798" : "#C9A657" }}>{currency(Math.max(totalEffectiveBudget - totalSpentThisMonth, 0))}</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>remaining</div>
          </div>
        </div>
        {totalCarryForward !== 0 && (
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 8, borderTop: "1px solid rgba(246,242,231,0.2)", paddingTop: 8 }}>
            Carried in from previous months: <strong>{signedCurrency(totalCarryForward)}</strong> {totalCarryForward < 0 ? "(overspend to make up)" : "(unspent rolled forward)"}
          </div>
        )}
      </div>

      <Section title="Accounts" icon="🏦" action={<button style={iconBtnStyle()} onClick={() => setShowAccForm((s) => !s)}>+ Account</button>}>
        {showAccForm && <AddAccountForm onAdd={(a) => setData({ ...data, accounts: [...data.accounts, a] })} onClose={() => setShowAccForm(false)} />}
        {data.accounts.length === 0 && !showAccForm && <p style={{ color: "#8A8370", fontSize: 14 }}>No accounts yet — add cash, mobile money, bank, or savings accounts.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.accounts.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFFDF8", border: "1px solid #E5DFCE", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14, fontWeight: 600, color: "#26313B" }}>{a.name}</span><AccountBadge label={a.type} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: a.balance < 0 ? "#C0533E" : "#26313B" }}>{currency(a.balance)}</span>
                <button onClick={() => removeAccount(a.id)} style={{ background: "none", border: "none", color: "#B0A98F", cursor: "pointer" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Overview" icon="📊">
        <ChartCard title="This month's expenses by category"><ExpensePieCSS categories={data.categories} spentThisMonthByCategory={spentThisMonthByCategory} /></ChartCard>
        <ChartCard title="Budget vs. spent (incl. carry-forward)"><BudgetVsSpentBars rows={categoryRows} /></ChartCard>
        <ChartCard title="Savings goals progress"><GoalsBars goals={data.goals} /></ChartCard>
      </Section>

      <Section title="Category budgets" icon="💰" action={<button style={iconBtnStyle()} onClick={() => setShowCatForm((s) => !s)}>+ Category</button>}>
        {showCatForm && <AddCategoryForm onAdd={(c) => setData({ ...data, categories: [...data.categories, c] })} onClose={() => setShowCatForm(false)} />}
        {data.categories.length === 0 && !showCatForm && <p style={{ color: "#8A8370", fontSize: 14 }}>No categories yet — add one to start budgeting.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {categoryRows.map((c) => {
            const pct = c.effectiveBudget > 0 ? (c.spentThisMonth / c.effectiveBudget) * 100 : 0;
            const danger = c.spentThisMonth > c.effectiveBudget;
            return (
              <div key={c.id} style={{ background: "#FFFDF8", border: "1px solid #E5DFCE", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#26313B" }}>{c.name}</span>
                  <button onClick={() => removeCategory(c.id)} style={{ background: "none", border: "none", color: "#B0A98F", cursor: "pointer" }}>✕</button>
                </div>
                <ProgressBar pct={pct} danger={danger} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: danger ? "#C0533E" : "#6B7280" }}>
                  <span>{currency(c.spentThisMonth)} spent</span><span>{currency(c.effectiveBudget)} available</span>
                </div>
                {c.carryForward !== 0 && <div style={{ fontSize: 11, color: c.carryForward < 0 ? "#C0533E" : "#5B7065", marginTop: 4 }}>Carried forward: {signedCurrency(c.carryForward)}</div>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Daily log" icon="🗓️" action={<button style={iconBtnStyle()} onClick={() => setShowExpForm((s) => !s)}>+ Expense</button>}>
        {showExpForm && <AddExpenseForm categories={data.categories} accounts={data.accounts} onAdd={addExpense} onClose={() => setShowExpForm(false)} />}
        {groupedByDay.length === 0 && !showExpForm && <p style={{ color: "#8A8370", fontSize: 14 }}>No expenses logged in {monthLabel(view.year, view.month)}.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groupedByDay.map(([day, items]) => {
            const dayTotal = items.reduce((s, e) => s + e.amount, 0);
            const dayLabel = new Date(day + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            return (
              <div key={day}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8C6D46", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}><span>{dayLabel}</span><span>{currency(dayTotal)}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#FFFDF8", border: "1px solid #E5DFCE", borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, color: "#26313B", fontWeight: 500 }}>{e.category}{e.note ? <span style={{ fontWeight: 400, color: "#6B7280" }}> — {e.note}</span> : ""}</div>
                        <div style={{ fontSize: 12, color: "#9A937C" }}>{e.date.slice(11, 16)} · {accountName(e.accountId)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: "#26313B" }}>{currency(e.amount)}</span>
                        <button onClick={() => removeExpense(e.id)} style={{ background: "none", border: "none", color: "#B0A98F", cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Savings goals" icon="🐷" action={<button style={iconBtnStyle()} onClick={() => setShowGoalForm((s) => !s)}>+ Goal</button>}>
        {showGoalForm && <AddGoalForm accounts={data.accounts} onAdd={(g) => setData({ ...data, goals: [...data.goals, g] })} onClose={() => setShowGoalForm(false)} />}
        {data.goals.length === 0 && !showGoalForm && <p style={{ color: "#8A8370", fontSize: 14 }}>No savings goals yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.goals.map((g) => {
            const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
            const reached = g.saved >= g.target;
            return (
              <div key={g.id} style={{ background: "#FFFDF8", border: "1px solid #E5DFCE", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14, fontWeight: 600, color: "#26313B" }}>{g.name}</span>{g.accountId && <AccountBadge label={accountName(g.accountId)} />}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{reached && <StampBadge label="Reached" />}<button onClick={() => removeGoal(g.id)} style={{ background: "none", border: "none", color: "#B0A98F", cursor: "pointer" }}>✕</button></div>
                </div>
                <ProgressBar pct={pct} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#6B7280" }}><span>{currency(g.saved)} saved</span><span>{currency(g.target)} target</span></div>
                {!reached && contributingGoalId !== g.id && <button onClick={() => setContributingGoalId(g.id)} style={{ ...iconBtnStyle(), marginTop: 8 }}>↗ Add savings</button>}
                {contributingGoalId === g.id && <ContributeForm accounts={data.accounts} onContribute={(amt, accId) => contributeToGoal(g.id, amt, accId)} onClose={() => setContributingGoalId(null)} />}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ---------- Login ----------
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true); setError(null);
    try {
      const { auth, signInWithEmailAndPassword } = window.__fb;
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError("Couldn't sign in — check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F2E7", padding: 24 }}>
      <div style={{ maxWidth: 340, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700, color: "#1B3B2F" }}>BridgeGap</div>
          <div style={{ fontSize: 12, color: "#8A8370", marginTop: 2 }}>Household Ledger</div>
        </div>
        {error && <div style={{ background: "#FBEAE6", color: "#C0533E", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          <button onClick={handleLogin} disabled={busy || !email || !password} style={primaryBtnStyle}>{busy ? "Signing in…" : "Sign in"}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- App root ----------
function App() {
  const [fbReady, setFbReady] = useState(!!window.__fb);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("household");

  useEffect(() => {
    if (fbReady) return;
    const onReady = () => setFbReady(true);
    window.addEventListener("fb-ready", onReady);
    return () => window.removeEventListener("fb-ready", onReady);
  }, [fbReady]);

  useEffect(() => {
    if (!fbReady) return;
    const { auth, onAuthStateChanged } = window.__fb;
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthChecked(true); });
    return () => unsub();
  }, [fbReady]);

  if (!fbReady || !authChecked) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F2E7", color: "#8A8370" }}>Loading BridgeGap…</div>;
  }
  if (!user) return <LoginScreen />;

  return (
    <div style={{ minHeight: "100vh", background: "#F6F2E7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", paddingBottom: 40 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1B3B2F" }}>BridgeGap</div>
          <div style={{ fontSize: 12, color: "#8A8370", marginTop: 2 }}>{user.email}</div>
        </div>

        <div style={{ display: "flex", background: "#EFE9D8", borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {[{ key: "household", label: "Household" }, { key: "personal", label: "Personal" }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: tab === t.key ? "#1B3B2F" : "transparent", color: tab === t.key ? "#F6F2E7" : "#6B7280" }}>{t.label}</button>
          ))}
        </div>

        {tab === "household" ? <Ledger docPath="household" label="Household" /> : <Ledger docPath={`personal_${user.uid}`} label="Personal" />}

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => window.__fb.signOut(window.__fb.auth)} style={{ ...ghostBtnStyle, fontSize: 12 }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
