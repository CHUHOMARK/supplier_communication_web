import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const COLORS = {
  confirmed: "#10b981", // 绿色 - 已确认
  unconfirmed: "#f59e0b", // 橙色 - 未确认
};

export function DashboardCharts() {
  const { data: confirmStats, isLoading } = trpc.dashboard.getSupplierConfirmationStats.useQuery();

  // 准备饼图数据
  const chartData = confirmStats
    ? [
        { name: "已确认供应商", value: confirmStats.confirmed, color: COLORS.confirmed },
        { name: "未确认供应商", value: confirmStats.unconfirmed, color: COLORS.unconfirmed },
      ].filter((item) => item.value > 0) // 只显示有数据的部分
    : [];

  // 自定义标签渲染函数
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="mt-8">
      <Card>
        <CardHeader>
          <CardTitle>供应商确认状态</CardTitle>
          <CardDescription>已确认和未确认供应商的数量统计</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : chartData.length > 0 ? (
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* 饼图 */}
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomLabel}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 统计卡片 */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-green-700">已确认供应商</CardDescription>
                    <CardTitle className="text-3xl text-green-600">
                      {confirmStats?.confirmed || 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-green-600">
                      {confirmStats?.total
                        ? `占比 ${((confirmStats.confirmed / confirmStats.total) * 100).toFixed(1)}%`
                        : "暂无数据"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-orange-700">未确认供应商</CardDescription>
                    <CardTitle className="text-3xl text-orange-600">
                      {confirmStats?.unconfirmed || 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-orange-600">
                      {confirmStats?.total
                        ? `占比 ${((confirmStats.unconfirmed / confirmStats.total) * 100).toFixed(1)}%`
                        : "暂无数据"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-blue-700">供应商总数</CardDescription>
                    <CardTitle className="text-3xl text-blue-600">
                      {confirmStats?.total || 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-blue-600">
                      {confirmStats?.confirmed && confirmStats?.total
                        ? `确认率 ${((confirmStats.confirmed / confirmStats.total) * 100).toFixed(1)}%`
                        : "暂无数据"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
              <svg
                className="w-16 h-16 mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-lg font-medium">暂无供应商确认数据</p>
              <p className="text-sm mt-2">请先上传物料计划并生成邮件发送给供应商</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
