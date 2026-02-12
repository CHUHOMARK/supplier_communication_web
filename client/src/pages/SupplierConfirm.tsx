import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { ProductionStepper } from "@/components/ProductionStepper";

/**
 * 供应商交期确认页面
 * 通过邮件链接访问，无需登录
 */
export default function SupplierConfirm() {
  const [, params] = useRoute("/confirm/:token");
  const token = params?.token || "";

  const [status, setStatus] = useState<"confirmed" | "rejected" | "modified">("confirmed");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [editedSchedules, setEditedSchedules] = useState<Record<string, Record<string, number>>>({});
  const [modificationReasons, setModificationReasons] = useState<Record<string, string>>({});

  const { data, isLoading, error } = trpc.confirmation.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const submitMutation = trpc.confirmation.submit.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      toast.success("确认提交成功");
    },
    onError: (error) => {
      toast.error(`提交失败: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  const submitModificationsMutation = trpc.confirmation.submitModifications.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      toast.success("修改提交成功");
    },
    onError: (error) => {
      toast.error(`提交失败: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  const updateProductionStatusMutation = trpc.confirmation.updateProductionStatus.useMutation({
    onSuccess: () => {
      toast.success("生产状态更新成功");
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const handleSubmit = async () => {
    if (!token) return;

    setIsSubmitting(true);

    // 如果选择"修改交期"，需要提交修改的数据
    if (status === "modified" && Object.keys(editedSchedules).length > 0) {
      const modifications = Object.entries(editedSchedules).map(([materialCode, modifiedSchedule]) => ({
        materialCode,
        originalSchedule: data?.items.find((item: any) => item.materialCode === materialCode)?.dailySchedule || {},
        modifiedSchedule,
        modificationReason: modificationReasons[materialCode],
      }));

      submitModificationsMutation.mutate({
        token,
        modifications,
      });
    } else {
      submitMutation.mutate({
        token,
        status,
        supplierNotes: notes,
      });
    }
  };

  const handleScheduleChange = (materialCode: string, date: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value);
    setEditedSchedules(prev => ({
      ...prev,
      [materialCode]: {
        ...(prev[materialCode] || data?.items.find((item: any) => item.materialCode === materialCode)?.dailySchedule || {}),
        [date]: numValue,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载确认信息...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              无法加载确认信息
            </CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              确认提交成功
            </CardTitle>
            <CardDescription>
              感谢您的确认，我们已收到您的响应。采购方将会查看您的反馈。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { confirmation, supplier, plan, items } = data;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>物料交期确认</CardTitle>
            <CardDescription>
              供应商：{supplier?.supplierName || "未知"} | 计划周期：{plan?.planStartDate} 至 {plan?.planEndDate}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 生产进度步进器 */}
        <ProductionStepper
          currentStatus={confirmation.productionStatus || "not_started"}
          onStatusChange={async (status) => {
            await updateProductionStatusMutation.mutateAsync({
              token,
              productionStatus: status,
            });
          }}
          disabled={isSubmitting}
        />

        <Card className="mb-6 mt-6">
          <CardHeader>
            <CardTitle>物料清单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {(() => {
                // 收集所有日期
                const allDates = new Set<string>();
                items.forEach((item: any) => {
                  if (item.dailySchedule && typeof item.dailySchedule === 'object') {
                    Object.keys(item.dailySchedule).forEach(date => allDates.add(date));
                  }
                });
                const sortedDates = Array.from(allDates).sort();
                
                // 格式化日期显示
                const formatDate = (dateStr: string) => {
                  try {
                    const date = new Date(dateStr);
                    return `${date.getMonth() + 1}月${date.getDate()}日`;
                  } catch {
                    return dateStr;
                  }
                };
                
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 whitespace-nowrap">物料代码</th>
                        <th className="text-left p-2 whitespace-nowrap">物料名称</th>
                        <th className="text-left p-2 whitespace-nowrap">规格</th>
                        <th className="text-right p-2 whitespace-nowrap">当前库存</th>
                        {sortedDates.map(date => (
                          <th key={date} className="text-right p-2 whitespace-nowrap">{formatDate(date)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any) => {
                        const schedule = editedSchedules[item.materialCode] || item.dailySchedule || {};
                        return (
                          <tr key={item.id} className={`border-b ${status === "modified" ? "hover:bg-blue-50" : "hover:bg-gray-50"}`}>
                            <td className="p-2 whitespace-nowrap">{item.materialCode}</td>
                            <td className="p-2">{item.materialName || "-"}</td>
                            <td className="p-2">{item.materialSpec || "-"}</td>
                            <td className="text-right p-2">{item.inventory || "-"}</td>
                            {sortedDates.map(date => (
                              <td key={date} className="text-right p-2">
                                {status === "modified" ? (
                                  <Input
                                    type="number"
                                    value={schedule[date] || ""}
                                    onChange={(e) => handleScheduleChange(item.materialCode, date, e.target.value)}
                                    className="w-16 text-right h-8"
                                    min="0"
                                    style={{ MozAppearance: 'textfield' }}
                                  />
                                ) : (
                                  <span>{schedule[date] ? Number(schedule[date]).toFixed(0) : ""}</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>确认响应</CardTitle>
            <CardDescription>请选择您的响应类型并添加备注</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={status} onValueChange={(v: any) => setStatus(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="confirmed" id="confirmed" />
                <Label htmlFor="confirmed" className="cursor-pointer">
                  <div>
                    <div className="font-medium">确认交期</div>
                    <div className="text-sm text-gray-500">我们可以按计划交付所有物料</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="modified" id="modified" />
                <Label htmlFor="modified" className="cursor-pointer">
                  <div>
                    <div className="font-medium">修改交期</div>
                    <div className="text-sm text-gray-500">需要调整交货时间或数量</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rejected" id="rejected" />
                <Label htmlFor="rejected" className="cursor-pointer">
                  <div>
                    <div className="font-medium">无法交付</div>
                    <div className="text-sm text-gray-500">当前无法满足交货要求</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {status === "modified" && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  💡 提示：您可以在上方表格中直接编辑物料的交期数量。请在下方说明修改原因。
                </p>
                <style>{`
                  input[type="number"]::-webkit-outer-spin-button,
                  input[type="number"]::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                  }
                `}</style>
              </div>
            )}

            <div>
              <Label htmlFor="notes">备注说明</Label>
              <Textarea
                id="notes"
                placeholder="请说明具体情况，如调整后的交期、数量等..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="mt-2"
              />
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    提交中...
                  </>
                ) : (
                  "提交确认"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
