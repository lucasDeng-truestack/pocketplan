# HealthScore

A 0 to 100 score for how safe the month looks, computed only from data PocketPlan already holds. **Suggested default, to confirm with Lucas**: four signals, 25 points each, summed.

| Signal | 25 points when | 0 points when |
|---|---|---|
| Buffer | Unallocated is 20% or more of total remaining | Unallocated is zero |
| Envelopes | Every envelope with a target holds at least 25% of it | Any targeted envelope is at zero |
| Pace | Spending so far this month is at or under the average of the last three months at the same day | 150% or more of that average (no history: 25 points) |

With no targeted envelope the Envelopes signal gives 25 points. The "usual pace" wording in the sample assumes earlier months that are illustrative here.
| Habit | An entry on 5 or more of the last 7 days | No entries in 7 days |

Bands: 75 to 100 Strong, 50 to 74 Watch, under 50 At risk. The band always has an icon and a word, never colour alone.

- Layout: the score in `amount-xl`, the band with its icon, "How it's scored" link, a Meter whose fill is `primary` (`destructive` for At risk) on a `muted` track, then one line per signal with a check or alert icon.
- Watch and At risk add one sentence that names the envelope to fix. Keep it to one action.
- The Meter is a shadcn Progress; the score is recomputed on read, never stored.
- Motion: the number counts up and the meter fills over 400ms on first paint; reduced motion shows the final state.