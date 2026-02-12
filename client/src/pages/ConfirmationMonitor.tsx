import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock, FileText, History, LayoutGrid, LayoutList } from "lucide-react";
import { Link } from "wouter";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * 供应商确认监控面板
 * 采购方查看所有供应商的确认状态，对比ERP实际到货数据
 */
export default function ConfirmationMonitor() {
  const { user, logout } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedConfirmationId, setSelectedConfirmationId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("table"); // 默认表格视图

  const { data: stats, isLoading: statsLoading } = trpc.confirmation.getStats.useQuery();
  const { data: plans, isLoading: plansLoading } = trpc.materialPlan.list.useQuery();
  const { data: confirmations, isLoading: confirmationsLoading } = trpc.confirmation.getByPlanId.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );

  // 获取ERP实际到货数据
  const confirmationIds = confirmations?.map(c => c.confirmation.id) || [];
  const { data: erpReceipts } = trpc.erp.getReceiptsForConfirmations.useQuery(
    { confirmationIds },
    { enabled: confirmationIds.length > 0 }
  );

  const { data: modifications, isLoading: modificationsLoading } = trpc.confirmation.getModifications.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId && !!selectedConfirmationId }
  );

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

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

  // 计算到货偏差天数
  const calculateDeviationDays = (confirmationId: number): { days: number | null; actualDate: string | null } => {
    if (!erpReceipts || !confirmations) return { days: null, actualDate: null };
    
    const confirmation = confirmations.find(c => c.confirmation.id === confirmationId);
    if (!confirmation?.confirmation.confirmedAt) return { days: null, actualDate: null };

    // 查找对应的ERP到货记录
    const receipt = erpReceipts.find(r => r.confirmationId === confirmationId);
    if (!receipt || !receipt.actualReceiptDate) return { days: null, actualDate: null };

    const confirmedDate = new Date(confirmation.confirmation.confirmedAt);
    const actualDate = new Date(receipt.actualReceiptDate);
    
    // 计算天数差异（实际到货日期 - 承诺日期）
    const diffTime = actualDate.getTime() - confirmedDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      days: diffDays,
      actualDate: receipt.actualReceiptDate
    };
  };

  // 获取特定确认记录的修改历史
  const getConfirmationModifications = () => {
    if (!modifications || !selectedConfirmationId) return [];
    return modifications.filter(m => m.confirmation?.id === selectedConfirmationId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                  <Clock className="h-8 w-8 text-primary" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">供应商物料计划沟通工具</h1>
                    <p className="text-xs text-gray-500">确认监控</p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <NotificationCenter />
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-medium">{user?.name?.[0] || user?.username?.[0] || "U"}</span>
                </div>
                <span>{user?.name || user?.username}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                登出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>物料计划确认详情</CardTitle>
                <CardDescription>点击查看每个计划的供应商确认状态和ERP到货对比</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "card" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  卡片视图
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  <LayoutList className="h-4 w-4 mr-1" />
                  表格视图
                </Button>
              </div>
            </div>
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
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>供应商确认详情 - ERP到货对比</DialogTitle>
              <DialogDescription>
                查看该物料计划的所有供应商确认状态和实际到货情况
              </DialogDescription>
            </DialogHeader>

            {confirmationsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : confirmations && confirmations.length > 0 ? (
              viewMode === "table" ? (
                // 表格视图
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>供应商</TableHead>
                        <TableHead>联系人</TableHead>
                        <TableHead>邮箱</TableHead>
                        <TableHead>确认状态</TableHead>
                        <TableHead>承诺交期</TableHead>
                        <TableHead>ERP实际到货</TableHead>
                        <TableHead>到货偏差（天）</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {confirmations.map(({ confirmation, supplier }) => {
                        const { days, actualDate } = calculateDeviationDays(confirmation.id);
                        const isOverdue = days !== null && days > 0;
                        
                        return (
                          <TableRow key={confirmation.id} className={isOverdue ? "bg-red-50" : ""}>
                            <TableCell className="font-medium">{supplier?.supplierName || "未知供应商"}</TableCell>
                            <TableCell>{supplier?.contactPerson || "-"}</TableCell>
                            <TableCell className="text-sm">{supplier?.email || "-"}</TableCell>
                            <TableCell>{getStatusBadge(confirmation.status)}</TableCell>
                            <TableCell>
                              {confirmation.confirmedAt 
                                ? new Date(confirmation.confirmedAt).toLocaleDateString('zh-CN')
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {actualDate ? (
                                <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                  {new Date(actualDate).toLocaleDateString('zh-CN')}
                                </span>
                              ) : (
                                <span className="text-gray-400">未到货</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {days !== null ? (
                                <span className={isOverdue ? "text-red-600 font-bold" : "text-green-600 font-medium"}>
                                  {days > 0 ? `+${days}` : days} 天
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {confirmation.status === "modified" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedConfirmationId(confirmation.id);
                                  }}
                                >
                                  <History className="h-4 w-4 mr-1" />
                                  查看历史
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                // 卡片视图
                <div className="space-y-4">
                  {confirmations.map(({ confirmation, supplier }) => {
                    const { days, actualDate } = calculateDeviationDays(confirmation.id);
                    const isOverdue = days !== null && days > 0;
                    
                    return (
                      <Card key={confirmation.id} className={isOverdue ? "border-red-300 bg-red-50" : ""}>
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
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600 mb-1">承诺交期：</p>
                              <p className="font-medium">
                                {confirmation.confirmedAt 
                                  ? new Date(confirmation.confirmedAt).toLocaleDateString('zh-CN')
                                  : "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 mb-1">ERP实际到货：</p>
                              <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>
                                {actualDate ? new Date(actualDate).toLocaleDateString('zh-CN') : "未到货"}
                              </p>
                            </div>
                            {days !== null && (
                              <div className="col-span-2">
                                <p className="text-gray-600 mb-1">到货偏差：</p>
                                <p className={`font-bold text-lg ${isOverdue ? "text-red-600" : "text-green-600"}`}>
                                  {days > 0 ? `延迟 ${days} 天` : days === 0 ? "准时到货" : `提前 ${Math.abs(days)} 天`}
                                </p>
                              </div>
                            )}
                          </div>
                          {confirmation.supplierNotes && (
                            <div className="mt-4">
                              <p className="text-sm font-medium mb-1">供应商备注：</p>
                              <p className="text-sm text-gray-700 bg-white p-3 rounded border">
                                {confirmation.supplierNotes}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
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
                                      ...Object.keys(modifiedSchedule)
                                    ]);
                                    
                                    return Array.from(allDates).sort().map(date => {
                                      const original = originalSchedule[date] || 0;
                                      const modified = modifiedSchedule[date] || 0;
                                      const diff = modified - original;
                                      
                                      return (
                                        <tr key={date} className="border-b">
                                          <td className="p-2">{date}</td>
                                          <td className="text-right p-2">{original}</td>
                                          <td className="text-right p-2">{modified}</td>
                                          <td className={`text-right p-2 font-medium ${
                                            diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : ''
                                          }`}>
                                            {diff > 0 ? `+${diff}` : diff}
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    暂无修改历史记录
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
