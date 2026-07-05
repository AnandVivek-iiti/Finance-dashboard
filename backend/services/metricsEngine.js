const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(start, end) {
  if (!start || !end) return null;
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  return Math.max(months, 1);
}

function computeMetrics(allTxns) {
  const unreconciledCount = allTxns.filter((t) => t.reconciled === false).length;
  const txns = allTxns.filter((t) => t.reconciled !== false);

  if (!txns.length) {
    return { empty: true, transactionCount: 0, unreconciledCount };
  }

  const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
  const rangeStart = new Date(sorted[0].date);
  const rangeEnd = new Date(sorted[sorted.length - 1].date);
  const monthSpan = monthsBetween(rangeStart, rangeEnd);
  const yearSpan = monthSpan ? monthSpan / 12 : null;

  let totalSpentPaise = 0;
  let totalReceivedPaise = 0;
  let highestWithdrawal = null;
  let highestDeposit = null;
  let lowestBalance = null;

  const byCategory = new Map(); // category -> { totalPaise, count }
  const byMonth = new Map(); // "YYYY-MM" -> { spentPaise, receivedPaise, count, sumPaise }
  const byDayOfWeek = new Map(); // dayName -> { spentPaise, count }
  const byMerchant = new Map(); // merchant -> { totalPaise, count }
  const byMonthCategory = new Map(); // "YYYY-MM" -> Map(category -> totalPaise)

  let cashPaise = 0;
  let digitalPaise = 0;

  for (const t of sorted) {
    const mKey = monthKey(t.date);
    const dayName = DAY_NAMES[new Date(t.date).getUTCDay()];

    if (t.type === "debit") {
      totalSpentPaise += t.withdrawalPaise || 0;

      if (!highestWithdrawal || t.withdrawalPaise > highestWithdrawal.amountPaise) {
        highestWithdrawal = { amountPaise: t.withdrawalPaise, date: t.date, remarks: t.remarks };
      }

      const cat = byCategory.get(t.category) || { totalPaise: 0, count: 0 };
      cat.totalPaise += t.withdrawalPaise || 0;
      cat.count += 1;
      byCategory.set(t.category, cat);

      const dow = byDayOfWeek.get(dayName) || { spentPaise: 0, count: 0 };
      dow.spentPaise += t.withdrawalPaise || 0;
      dow.count += 1;
      byDayOfWeek.set(dayName, dow);

      if (t.merchantOrSource) {
        const m = byMerchant.get(t.merchantOrSource) || { totalPaise: 0, count: 0 };
        m.totalPaise += t.withdrawalPaise || 0;
        m.count += 1;
        byMerchant.set(t.merchantOrSource, m);
      }

      if (t.category === "ATM Withdrawal") cashPaise += t.withdrawalPaise || 0;
      else digitalPaise += t.withdrawalPaise || 0;

      const mc = byMonthCategory.get(mKey) || new Map();
      mc.set(t.category, (mc.get(t.category) || 0) + (t.withdrawalPaise || 0));
      byMonthCategory.set(mKey, mc);
    } else {
      totalReceivedPaise += t.depositPaise || 0;
      if (!highestDeposit || t.depositPaise > highestDeposit.amountPaise) {
        highestDeposit = { amountPaise: t.depositPaise, date: t.date, remarks: t.remarks };
      }
    }

    if (!lowestBalance || t.balancePaise < lowestBalance.balancePaise) {
      lowestBalance = { balancePaise: t.balancePaise, date: t.date };
    }

    const month = byMonth.get(mKey) || { spentPaise: 0, receivedPaise: 0, count: 0 };
    month.count += 1;
    if (t.type === "debit") month.spentPaise += t.withdrawalPaise || 0;
    else month.receivedPaise += t.depositPaise || 0;
    byMonth.set(mKey, month);
  }

  const netSavingsPaise = totalReceivedPaise - totalSpentPaise;
  const savingsRatePercent = totalReceivedPaise > 0 ? (netSavingsPaise / totalReceivedPaise) * 100 : null;

  const avgMonthlySpendPaise = monthSpan ? Math.round(totalSpentPaise / monthSpan) : null;
  const avgMonthlyIncomePaise = monthSpan ? Math.round(totalReceivedPaise / monthSpan) : null;
  const avgYearlySpendPaise = yearSpan && yearSpan >= 1 ? Math.round(totalSpentPaise / yearSpan) : null;
  const avgTransactionSizePaise = sorted.length
    ? Math.round(
        sorted.reduce((sum, t) => sum + Math.abs(t.withdrawalPaise || t.depositPaise || 0), 0) / sorted.length
      )
    : null;

  const spendByCategory = [...byCategory.entries()]
    .map(([category, v]) => ({ category, totalPaise: v.totalPaise, count: v.count }))
    .sort((a, b) => b.totalPaise - a.totalPaise);

  const monthlySpendTrend = [...byMonth.entries()]
    .map(([month, v]) => ({ month, totalSpentPaise: v.spentPaise, totalReceivedPaise: v.receivedPaise, transactionCount: v.count }))
    .sort((a, b) => (a.month > b.month ? 1 : -1));

  const balanceOverTime = sorted.map((t) => ({ date: t.date, balancePaise: t.balancePaise }));

  const dayOfWeekPattern = DAY_NAMES.map((day) => ({
    day,
    spentPaise: byDayOfWeek.get(day)?.spentPaise || 0,
    count: byDayOfWeek.get(day)?.count || 0,
  }));

  const topMerchants = [...byMerchant.entries()]
    .map(([merchant, v]) => ({ merchant, totalPaise: v.totalPaise, count: v.count }))
    .sort((a, b) => b.totalPaise - a.totalPaise)
    .slice(0, 10);

  const transactionsPerMonth = [...byMonth.entries()]
    .map(([month, v]) => ({
      month,
      count: v.count,
      avgTransactionSizePaise: v.count ? Math.round((v.spentPaise + v.receivedPaise) / v.count) : 0,
    }))
    .sort((a, b) => (a.month > b.month ? 1 : -1));

  const largestExpenseCategoryPerMonth = [...byMonthCategory.entries()]
    .map(([month, catMap]) => {
      let top = null;
      for (const [category, totalPaise] of catMap.entries()) {
        if (!top || totalPaise > top.totalPaise) top = { category, totalPaise };
      }
      return { month, ...top };
    })
    .sort((a, b) => (a.month > b.month ? 1 : -1));

  const recurringPayments = detectRecurringPayments(sorted);

  return {
    empty: false,
    transactionCount: sorted.length,
    unreconciledCount,
    rangeStart,
    rangeEnd,
    totalSpentPaise,
    totalReceivedPaise,
    netSavingsPaise,
    savingsRatePercent,
    avgMonthlySpendPaise,
    avgMonthlyIncomePaise,
    avgYearlySpendPaise,
    avgTransactionSizePaise,
    highestWithdrawal,
    highestDeposit,
    spendByCategory,
    monthlySpendTrend,
    balanceOverTime,
    dayOfWeekPattern,
    topMerchants,
    transactionsPerMonth,
    recurringPayments,
    cashVsDigitalSplit: { cashPaise, digitalPaise },
    largestExpenseCategoryPerMonth,
    lowestBalancePoint: lowestBalance,
  };
}


function detectRecurringPayments(sorted) {
  const groups = new Map(); // key -> [{date, amountPaise}]

  for (const t of sorted) {
    if (t.type !== "debit" || !t.withdrawalPaise) continue;
    const key = t.merchantOrSource || t.category;
    if (!key) continue;
    const arr = groups.get(key) || [];
    arr.push({ date: new Date(t.date), amountPaise: t.withdrawalPaise, remarks: t.remarks });
    groups.set(key, arr);
  }

  const recurring = [];
  for (const [key, occurrences] of groups.entries()) {
    if (occurrences.length < 2) continue;
    occurrences.sort((a, b) => a.date - b.date);

    let matchedPairs = 0;
    for (let i = 1; i < occurrences.length; i++) {
      const daysApart = (occurrences[i].date - occurrences[i - 1].date) / (1000 * 60 * 60 * 24);
      const amountDiffPct =
        Math.abs(occurrences[i].amountPaise - occurrences[i - 1].amountPaise) / occurrences[i - 1].amountPaise;
      if (daysApart >= 25 && daysApart <= 35 && amountDiffPct <= 0.02) matchedPairs++;
    }

    if (matchedPairs >= 1) {
      const avgAmountPaise = Math.round(
        occurrences.reduce((sum, o) => sum + o.amountPaise, 0) / occurrences.length
      );
      recurring.push({
        merchantOrCategory: key,
        occurrenceCount: occurrences.length,
        avgAmountPaise,
        lastDate: occurrences[occurrences.length - 1].date,
      });
    }
  }

  return recurring.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
}

module.exports = { computeMetrics };