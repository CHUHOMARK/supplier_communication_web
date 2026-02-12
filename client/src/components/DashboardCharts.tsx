import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function DashboardCharts() {
  const { data: emailTrend, isLoading: emailLoading } = trpc.dashboard.getEmailSendTrend.useQuery({ days: 30 });
  const { data: confirmTrend, isLoading: confirmLoading } = trpc.dashboard.getConfirmationRateTrend.useQuery({ days: 30 });
  const { data: responseStats, isLoading: responseLoading } = trpc.dashboard.getSupplierResponseTimeStats.useQuery();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* 邮件发送量趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>邮件发送量趋势</CardTitle>
          <CardDescription>最近30天的邮件发送统计</CardDescription>
        </CardHeader>
        <CardContent>
          {emailLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : emailTrend && emailTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={emailTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => {
                    const date = new Date(value as string);
                    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="发送数量"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 确认率趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>确认率趋势</CardTitle>
          <CardDescription>最近30天的供应商确认统计</CardDescription>
        </CardHeader>
        <CardContent>
          {confirmLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : confirmTrend && confirmTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={confirmTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  labelFormatter={(value) => {
                    const date = new Date(value as string);
                    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total"
                  name="总数"
                  stroke="#94a3b8"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="confirmed"
                  name="已确认"
                  stroke="#10b981"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rate"
                  name="确认率(%)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 供应商响应时间统计 */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>供应商平均响应时间</CardTitle>
          <CardDescription>各供应商的平均响应时间（小时）</CardDescription>
        </CardHeader>
        <CardContent>
          {responseLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : responseStats && responseStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={responseStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="supplierName"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis label={{ value: "小时", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgResponseTime" name="平均响应时间" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
