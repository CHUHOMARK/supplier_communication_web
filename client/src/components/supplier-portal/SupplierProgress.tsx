import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Factory, CheckCircle, Clock, Package, Truck, ClipboardCheck } from "lucide-react";

const PROGRESS_STEPS = [
  { key: "material_prep", label: "备料", icon: Package },
  { key: "scheduling", label: "排产", icon: Factory },
  { key: "quality_check", label: "质检", icon: ClipboardCheck },
  { key: "shipping", label: "出货", icon: Truck },
  { key: "delivered", label: "已交付", icon: CheckCircle },
];

export default function SupplierProgress() {
  const { data: planData } = trpc.supplierPortal.getMaterials.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const planId = planData?.plan?.id;
  const { data, isLoading, refetch } = trpc.supplierPortal.getProgress.useQuery(
    { planId: planId! },
    { staleTime: 5 * 60 * 1000, enabled: !!planId }
  );

  const updateMutation = trpc.supplierPortal.updateProgress.useMutation({
    onSuccess: () => {
      toast.success("生产进度已更新");
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失败：${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载生产进度...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Factory className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="mt-4 text-gray-500">暂无生产进度数据</p>
          <p className="text-sm text-gray-400 mt-1">请等待采购方发布物料计划后更新进度</p>
        </CardContent>
      </Card>
    );
  }

  const getStepIndex = (step: string) => {
    return PROGRESS_STEPS.findIndex(s => s.key === step);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Factory className="w-5 h-5" />
            生产进度跟踪
          </CardTitle>
          <p className="text-sm text-gray-500">更新您负责物料的生产进度</p>
        </CardHeader>
      </Card>

      {data.map((item: any) => {
        const currentStepIndex = getStepIndex(item.currentStep || "material_prep");
        
        return (
          <Card key={item.materialCode}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-mono text-sm text-gray-600">{item.materialCode}</p>
                  <p className="font-medium">{item.materialName}</p>
                </div>
                <Select
                  value={item.currentStep || "material_prep"}
                  onValueChange={(value) => {
                    updateMutation.mutate({
                      planId: planId!,
                      materialCode: item.materialCode,
                      currentStep: value as any,
                    });
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRESS_STEPS.map(step => (
                      <SelectItem key={step.key} value={step.key}>
                        {step.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 进度时间线 */}
              <div className="flex items-center justify-between">
                {PROGRESS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  
                  return (
                    <div key={step.key} className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-2 ring-blue-300' : ''}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className={`text-xs mt-1 ${isCompleted ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      {index < PROGRESS_STEPS.length - 1 && (
                        <div className={`absolute h-0.5 w-full ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
