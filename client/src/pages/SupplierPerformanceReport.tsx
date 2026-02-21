import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Clock, AlertTriangle } from "lucide-react";
import { SupplierDetailsDialog } from "@/components/SupplierDetailsDialog";

export default function SupplierPerformanceReport() {
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<{ name: string; planId: number } | null>(null);

  // 获取物料计划列表
  const { data: plans, isLoading: plansLoading } = trpc.materialPlan.list.useQuery();

  // 获取绩效报表数据
  const { data: reportData, isLoading: reportLoading } = trpc.erp.getPerformanceReport.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );

  const handlePlanChange = (value: string) => {
    setSelectedPlanId(parseInt(value));
  };

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">供应商绩效报表</h1>
            <p className="text-gray-600 mt-2">分析供应商承诺交期与实际到货的对比，评估供应商可靠性</p>
          </div>
        </div>

        {/* 物料计划选择器 */}
        <Card>
          <CardHeader>
            <CardTitle>选择物料计划</CardTitle>
            <CardDescription>选择要分析的物料计划</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handlePlanChange} value={selectedPlanId?.toString()}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择物料计划" />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id.toString()}>
                    {plan.fileName} ({plan.planStartDate} ~ {plan.planEndDate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 报表内容 */}
        {selectedPlanId && (
          <>
            {reportLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">加载报表数据...</p>
                </div>
              </div>
            ) : reportData ? (
              <>
                {/* 准时率统计卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {reportData.performanceStats.map((stat) => (
                    <Card 
                      key={stat.supplierId}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedSupplier({ name: stat.supplierName, planId: selectedPlanId! })}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">
                          {stat.supplierName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">准时率</span>
                            <span
                              className={`text-lg font-bold ${
                                stat.onTimeRate >= 80
                                  ? "text-green-600"
                                  : stat.onTimeRate >= 60
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {stat.onTimeRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">准时次数</span>
                            <span className="text-green-600 font-medium">{stat.onTimeCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">逾期次数</span>
                            <span className="text-red-600 font-medium">{stat.lateCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">平均延迟</span>
                            <span className="text-orange-600 font-medium">
                              {stat.avgDelayDays.toFixed(1)}天
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* 逾期排行榜 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <CardTitle>逾期排行榜</CardTitle>
                    </div>
                    <CardDescription>按逾期次数排序的供应商列表</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">排名</TableHead>
                          <TableHead>供应商名称</TableHead>
                          <TableHead className="text-right">逾期次数</TableHead>
                          <TableHead className="text-right">准时次数</TableHead>
                          <TableHead className="text-right">准时率</TableHead>
                          <TableHead className="text-right">平均延迟天数</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.overdueRanking.map((item) => (
                          <TableRow key={item.supplierId}>
                            <TableCell className="font-medium">
                              {item.rank === 1 && <span className="text-red-600">🥇</span>}
                              {item.rank === 2 && <span className="text-orange-600">🥈</span>}
                              {item.rank === 3 && <span className="text-yellow-600">🥉</span>}
                              {item.rank > 3 && <span className="text-gray-600">{item.rank}</span>}
                            </TableCell>
                            <TableCell>{item.supplierName}</TableCell>
                            <TableCell className="text-right">
                              <span className="text-red-600 font-medium">{item.lateCount}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-green-600 font-medium">{item.onTimeCount}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`font-medium ${
                                  item.onTimeRate >= 80
                                    ? "text-green-600"
                                    : item.onTimeRate >= 60
                                    ? "text-yellow-600"
                                    : "text-red-600"
                                }`}
                              >
                                {item.onTimeRate.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-orange-600 font-medium">
                                {item.avgDelayDays.toFixed(1)}天
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* 准时率趋势图 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <CardTitle>准时率趋势</CardTitle>
                    </div>
                    <CardDescription>按日期显示准时率变化趋势</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={reportData.onTimeRateTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          label={{ value: "准时率 (%)", angle: -90, position: "insideLeft" }}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "准时率"]}
                          labelFormatter={(label) => `日期: ${label}`}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="onTimeRate"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          name="准时率"
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">暂无数据</p>
                  <p className="text-sm text-gray-500 mt-2">请先导入ERP实际到货数据</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!selectedPlanId && (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">请选择物料计划以查看绩效报表</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 供应商详情对话框 */}
      {selectedSupplier && (
        <SupplierDetailsDialog
          open={!!selectedSupplier}
          onOpenChange={(open) => !open && setSelectedSupplier(null)}
          supplierName={selectedSupplier.name}
          planId={selectedSupplier.planId}
        />
      )}
    </div>
  );
}
