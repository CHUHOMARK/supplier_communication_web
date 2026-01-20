import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Settings as SettingsIcon, Trash2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Settings() {
  const [resetOptions, setResetOptions] = useState({
    resetMaterialPlans: false,
    resetSuppliers: false,
    resetMappings: false,
    resetEmails: false,
    resetEmailLogs: false,
  });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = trpc.dataReset.getStats.useQuery();
  const utils = trpc.useUtils();

  const resetMutation = trpc.dataReset.reset.useMutation({
    onSuccess: (data) => {
      toast.success("数据重置成功");
      setConfirmDialogOpen(false);
      setResetOptions({
        resetMaterialPlans: false,
        resetSuppliers: false,
        resetMappings: false,
        resetEmails: false,
        resetEmailLogs: false,
      });
      utils.dataReset.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(`重置失败：${error.message}`);
    },
  });

  const handleResetClick = () => {
    const hasSelection = Object.values(resetOptions).some(v => v);
    if (!hasSelection) {
      toast.error("请至少选择一项要重置的数据");
      return;
    }
    setConfirmDialogOpen(true);
  };

  const handleConfirmReset = () => {
    resetMutation.mutate(resetOptions);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          系统设置
        </h1>
        <p className="text-muted-foreground mt-2">
          管理系统数据和配置
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            数据重置
          </CardTitle>
          <CardDescription>
            清除测试数据或重新开始，避免数据混乱
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {statsLoading ? (
            <div className="text-center py-4 text-muted-foreground">加载中...</div>
          ) : stats && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">当前数据统计</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">物料计划</p>
                  <p className="text-2xl font-bold">{stats.materialPlans}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">供应商</p>
                  <p className="text-2xl font-bold">{stats.suppliers}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">物料映射</p>
                  <p className="text-2xl font-bold">{stats.mappings}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">生成邮件</p>
                  <p className="text-2xl font-bold">{stats.emails}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">发送记录</p>
                  <p className="text-2xl font-bold">{stats.emailLogs}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm font-medium">选择要重置的数据类型</p>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetMaterialPlans"
                  checked={resetOptions.resetMaterialPlans}
                  onCheckedChange={(checked) =>
                    setResetOptions({ ...resetOptions, resetMaterialPlans: checked as boolean })
                  }
                />
                <Label htmlFor="resetMaterialPlans" className="cursor-pointer">
                  物料计划和物料项（{stats?.materialPlans || 0} 条）
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetSuppliers"
                  checked={resetOptions.resetSuppliers}
                  onCheckedChange={(checked) =>
                    setResetOptions({ ...resetOptions, resetSuppliers: checked as boolean })
                  }
                />
                <Label htmlFor="resetSuppliers" className="cursor-pointer">
                  供应商信息（{stats?.suppliers || 0} 条）
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetMappings"
                  checked={resetOptions.resetMappings}
                  onCheckedChange={(checked) =>
                    setResetOptions({ ...resetOptions, resetMappings: checked as boolean })
                  }
                />
                <Label htmlFor="resetMappings" className="cursor-pointer">
                  物料-供应商映射关系（{stats?.mappings || 0} 条）
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetEmails"
                  checked={resetOptions.resetEmails}
                  onCheckedChange={(checked) =>
                    setResetOptions({ ...resetOptions, resetEmails: checked as boolean })
                  }
                />
                <Label htmlFor="resetEmails" className="cursor-pointer">
                  生成的邮件内容（{stats?.emails || 0} 条）
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetEmailLogs"
                  checked={resetOptions.resetEmailLogs}
                  onCheckedChange={(checked) =>
                    setResetOptions({ ...resetOptions, resetEmailLogs: checked as boolean })
                  }
                />
                <Label htmlFor="resetEmailLogs" className="cursor-pointer">
                  邮件发送记录（{stats?.emailLogs || 0} 条）
                </Label>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">警告：此操作不可恢复</p>
              <p className="text-muted-foreground mt-1">
                删除的数据将无法恢复，请谨慎操作。建议在重置前先导出重要数据。
              </p>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={handleResetClick}
            disabled={resetMutation.isPending}
            className="w-full"
          >
            {resetMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                重置中...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                重置选中的数据
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置数据</AlertDialogTitle>
            <AlertDialogDescription>
              您即将删除以下数据，此操作不可恢复：
              <ul className="list-disc list-inside mt-2 space-y-1">
                {resetOptions.resetMaterialPlans && <li>物料计划和物料项</li>}
                {resetOptions.resetSuppliers && <li>供应商信息</li>}
                {resetOptions.resetMappings && <li>物料-供应商映射关系</li>}
                {resetOptions.resetEmails && <li>生成的邮件内容</li>}
                {resetOptions.resetEmailLogs && <li>邮件发送记录</li>}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
