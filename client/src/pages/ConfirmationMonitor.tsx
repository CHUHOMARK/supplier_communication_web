import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock, FileText, History } from "lucide-react";
import { Link } from "wouter";

/**
 * 供应商确认监控面板
 * 采购方查看所有供应商的确认状态
 */
export default function ConfirmationMonitor() {
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedConfirmationId, setSelectedConfirmationId] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.confirmation.getStats.useQuery();
  const { data: plans, isLoading: plansLoading } = trpc.materialPlan.list.useQuery();
  const { data: confirmations, isLoading: confirmationsLoading } = trpc.confirmation.getByPlanId.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );

  const { data: modifications, isLoading: modificationsLoading } = trpc.confirmation.getModifications.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId && !!selectedConfirmationId }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />已确认</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" />部分确认</Badge>;
      case "rejected":
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />拒绝</Badge>;
      case "modified":
        return <Badge className="bg-blue-500"><FileText className="h-3 w-3 mr-1" />已修改</Badge>;
      case "pending":
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />待确认</Badge>;
    }
  };

  // 获取特定确认记录的修改历史
  const getConfirmationModifications = () => {
    if (!modifications || !selectedConfirmationId) return [];
    return modifications.filter(m => m.confirmation?.id === selectedConfirmationId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">供应商确认监控</h1>
              <p className="text-gray-600">查看和跟踪供应商的交期确认状态</p>
            </div>
            <Link href="/">
              <Button variant="outline">返回首页</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>总确认数</CardDescription>
              <CardTitle className="text-3xl">{stats?.total || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>待确认</CardDescription>
              <CardTitle className="text-3xl text-gray-500">{stats?.pending || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>已确认</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats?.confirmed || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>拒绝/修改</CardDescription>
              <CardTitle className="text-3xl text-red-600">{(stats?.rejected || 0) + (stats?.modified || 0)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* 物料计划列表 */}
        <Card>
          <CardHeader>
            <CardTitle>物料计划确认详情</CardTitle>
            <CardDescription>点击查看每个计划的供应商确认状态</CardDescription>
          </CardHeader>
          <CardContent>
            {plansLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : plans && plans.length > 0 ? (
              <div className="space-y-4">
                {plans.map((plan) => (
                  <Card key={plan.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPlanId(plan.id)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{plan.fileName}</CardTitle>
                          <CardDescription>
                            计划周期：{plan.planStartDate} 至 {plan.planEndDate}
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm">查看详情</Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                暂无物料计划
              </div>
            )}
          </CardContent>
        </Card>

        {/* 确认详情对话框 */}
        <Dialog open={!!selectedPlanId} onOpenChange={(open) => !open && setSelectedPlanId(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>供应商确认详情</DialogTitle>
              <DialogDescription>
                查看该物料计划的所有供应商确认状态
              </DialogDescription>
            </DialogHeader>

            {confirmationsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : confirmations && confirmations.length > 0 ? (
              <div className="space-y-4">
                {confirmations.map(({ confirmation, supplier }) => (
                  <Card key={confirmation.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{supplier?.supplierName || "未知供应商"}</CardTitle>
                          <CardDescription>
                            联系人：{supplier?.contactPerson || "-"} | 邮箱：{supplier?.email || "-"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(confirmation.status)}
                          {confirmation.status === "modified" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedConfirmationId(confirmation.id)}
                              className="ml-2"
                            >
                              <History className="h-4 w-4 mr-1" />
                              查看修改历史
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {(confirmation.supplierNotes || confirmation.confirmedAt) && (
                      <CardContent>
                        {confirmation.confirmedAt && (
                          <p className="text-sm text-gray-600 mb-2">
                            确认时间：{new Date(confirmation.confirmedAt).toLocaleString('zh-CN')}
                          </p>
                        )}
                        {confirmation.supplierNotes && (
                          <div>
                            <p className="text-sm font-medium mb-1">供应商备注：</p>
                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                              {confirmation.supplierNotes}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                该计划暂无供应商确认记录
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 修改历史查看对话框 */}
        <Dialog open={!!selectedConfirmationId} onOpenChange={(open) => !open && setSelectedConfirmationId(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>修改历史详情</DialogTitle>
              <DialogDescription>
                查看供应商提交的交期修改记录
              </DialogDescription>
            </DialogHeader>

            {modificationsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                {getConfirmationModifications().length > 0 ? (
                  getConfirmationModifications().map((item, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          物料：{item.modification?.materialCode}
                        </CardTitle>
                        <CardDescription>
                          修改时间：{new Date(item.modification?.modifiedAt || "").toLocaleString('zh-CN')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* 修改原因 */}
                          {item.modification?.modificationReason && (
                            <div>
                              <p className="text-sm font-medium mb-1">修改原因：</p>
                              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                {item.modification.modificationReason}
                              </p>
                            </div>
                          )}

                          {/* 修改对比表格 */}
                          <div>
                            <p className="text-sm font-medium mb-2">交期数量对比：</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="border-b bg-gray-50">
                                    <th className="text-left p-2 whitespace-nowrap">日期</th>
                                    <th className="text-right p-2 whitespace-nowrap">原始数量</th>
                                    <th className="text-right p-2 whitespace-nowrap">修改后数量</th>
                                    <th className="text-right p-2 whitespace-nowrap">变化</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const originalSchedule = item.modification?.originalSchedule || {};
                                    const modifiedSchedule = item.modification?.modifiedSchedule || {};
                                    const allDates = new Set([
                                      ...Object.keys(originalSchedule),
                                      ...Object.keys(modifiedSchedule),
                                    ]);
                                    const sortedDates = Array.from(allDates).sort();

                                    return sortedDates.map((date) => {
                                      const original = originalSchedule[date] || 0;
                                      const modified = modifiedSchedule[date] || 0;
                                      const change = modified - original;
                                      const changeColor = change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-600";

                                      return (
                                        <tr key={date} className="border-b hover:bg-gray-50">
                                          <td className="p-2 whitespace-nowrap">{date}</td>
                                          <td className="text-right p-2">{original}</td>
                                          <td className="text-right p-2">{modified}</td>
                                          <td className={`text-right p-2 font-medium ${changeColor}`}>
                                            {change > 0 ? "+" : ""}{change}
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 总量对比 */}
                          <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                            <div>
                              <p className="text-xs text-gray-600">原始总量</p>
                              <p className="text-lg font-semibold">
                                {Object.values(item.modification?.originalSchedule || {}).reduce((a: number, b: number) => a + b, 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">修改后总量</p>
                              <p className="text-lg font-semibold">
                                {Object.values(item.modification?.modifiedSchedule || {}).reduce((a: number, b: number) => a + b, 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">总变化</p>
                              <p className={`text-lg font-semibold ${
                                (Object.values(item.modification?.modifiedSchedule || {}).reduce((a: number, b: number) => a + b, 0) -
                                 Object.values(item.modification?.originalSchedule || {}).reduce((a: number, b: number) => a + b, 0)) > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}>
                                {Object.values(item.modification?.modifiedSchedule || {}).reduce((a: number, b: number) => a + b, 0) -
                                 Object.values(item.modification?.originalSchedule || {}).reduce((a: number, b: number) => a + b, 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    暂无修改记录
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
