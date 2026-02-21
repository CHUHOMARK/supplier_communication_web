import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ComparisonAnalysis() {
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // 获取物料计划列表
  const { data: plans } = trpc.materialPlan.list.useQuery();

  // 获取对比数据
  const { data: comparisonData, isLoading: isLoadingComparison } = trpc.erp.getComparison.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );

  // 获取统计汇总
  const { data: summary, isLoading: isLoadingSummary } = trpc.erp.getComparisonSummary.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );

  // 导出Excel
  const handleExport = () => {
    if (!comparisonData || !selectedPlanId) {
      toast.error("请先选择物料计划");
      return;
    }

    // TODO: 实现Excel导出功能
    toast.success("Excel导出功能开发中");
  };

  // 格式化百分比
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // 格式化数量
  const formatQuantity = (value: number) => {
    return value.toLocaleString();
  };

  // 获取差异颜色
  const getDifferenceColor = (difference: number) => {
    if (difference > 0) return "text-green-600";
    if (difference < 0) return "text-red-600";
    return "text-gray-600";
  };

  // 获取差异图标
  const getDifferenceIcon = (difference: number) => {
    if (difference > 0) return <TrendingUp className="h-4 w-4" />;
    if (difference < 0) return <TrendingDown className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">计划与实际对比分析</h1>
          <p className="text-muted-foreground mt-1">
            对比物料计划数量与ERP实际到货数量，分析差异情况
          </p>
        </div>
        <Button onClick={handleExport} disabled={!selectedPlanId}>
          <Download className="mr-2 h-4 w-4" />
          导出Excel
        </Button>
      </div>

      {/* 物料计划选择器 */}
      <Card>
        <CardHeader>
          <CardTitle>选择物料计划</CardTitle>
          <CardDescription>选择要分析的物料计划</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedPlanId?.toString() || ""}
            onValueChange={(value) => setSelectedPlanId(Number(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择物料计划" />
            </SelectTrigger>
            <SelectContent>
              {plans?.map((plan: any) => (
                <SelectItem key={plan.id} value={plan.id.toString()}>
                  {plan.fileName} ({plan.planStartDate} ~ {plan.planEndDate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 统计汇总卡片 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总计划数量
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatQuantity(summary.totalPlanned)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总实际数量
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatQuantity(summary.totalActual)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总差异
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getDifferenceColor(summary.totalDifference)}`}>
                {summary.totalDifference > 0 ? "+" : ""}
                {formatQuantity(summary.totalDifference)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                平均达成率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getDifferenceColor(summary.averagePercentage - 100)}`}>
                {formatPercentage(summary.averagePercentage)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 对比数据表格 */}
      {comparisonData && (
        <Card>
          <CardHeader>
            <CardTitle>物料对比详情</CardTitle>
            <CardDescription>
              共 {comparisonData.length} 个物料
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">料号</TableHead>
                    <TableHead className="w-[200px]">物料名称</TableHead>
                    <TableHead className="text-right">计划数量</TableHead>
                    <TableHead className="text-right">实际数量</TableHead>
                    <TableHead className="text-right">差异</TableHead>
                    <TableHead className="text-right">达成率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((item) => (
                    <TableRow key={item.materialCode}>
                      <TableCell className="font-mono">{item.materialCode}</TableCell>
                      <TableCell>{item.materialName}</TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(item.totalPlanned)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(item.totalActual)}
                      </TableCell>
                      <TableCell className={`text-right ${getDifferenceColor(item.totalDifference)}`}>
                        <div className="flex items-center justify-end gap-1">
                          {getDifferenceIcon(item.totalDifference)}
                          {item.totalDifference > 0 ? "+" : ""}
                          {formatQuantity(item.totalDifference)}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right ${getDifferenceColor(item.totalPercentage - 100)}`}>
                        {formatPercentage(item.totalPercentage)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 加载状态 */}
      {(isLoadingComparison || isLoadingSummary) && selectedPlanId && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">正在加载对比数据...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {!selectedPlanId && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">请选择物料计划以查看对比分析</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
