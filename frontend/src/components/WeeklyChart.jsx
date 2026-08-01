import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function WeeklyChart({ data }) {
  return (
    <div className="glass-panel p-6">
      <span className="eyebrow">Attività ultimi 7 giorni</span>
      <div className="h-56 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="seaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3FAF93" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3FAF93" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAE1F4" vertical={false} />
            <XAxis
              dataKey="giorno_settimana"
              stroke="#6B6478"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis stroke="#6B6478" fontSize={12} tickLine={false} axisLine={false} width={36} />
            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #EAE1F4",
                borderRadius: 12,
                color: "#251F30",
              }}
              formatter={(value) => [`${value} min`, "Allenamento"]}
            />
            <Area
              type="monotone"
              dataKey="minuti"
              stroke="#2E8E76"
              strokeWidth={2}
              fill="url(#seaFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
