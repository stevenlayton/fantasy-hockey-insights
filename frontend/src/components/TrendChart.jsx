import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

/**
 * Sparkline-style trend chart for a player's recent game log.
 * `gameLogs` should be chronological ASCENDING (oldest -> newest) so the
 * line reads left-to-right like a normal timeline.
 */
export default function TrendChart({ gameLogs, dataKey = 'points', label = 'Points', decimals = 1 }) {
  const chartData = gameLogs.map((g) => ({
    date: g.gameDate?.slice(5) || '', // MM-DD
    [dataKey]: g[dataKey] ?? 0,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2435" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#121826', border: '1px solid #1b2435', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value) =>
              typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(decimals) : value
            }
          />
          <Line type="monotone" dataKey={dataKey} name={label} stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
