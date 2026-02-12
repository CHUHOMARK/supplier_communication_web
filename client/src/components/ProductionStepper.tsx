import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Circle } from "lucide-react";

type ProductionStatus = "not_started" | "material_prep" | "in_production" | "in_qc" | "ready_to_ship" | "shipped";

interface ProductionStepperProps {
  currentStatus: ProductionStatus;
  onStatusChange: (status: ProductionStatus) => void;
  disabled?: boolean;
}

const steps: { key: ProductionStatus; label: string; description: string }[] = [
  { key: "not_started", label: "未开始", description: "订单已接收" },
  { key: "material_prep", label: "原料准备", description: "准备生产原料" },
  { key: "in_production", label: "生产中", description: "正在生产" },
  { key: "in_qc", label: "质检中", description: "质量检验" },
  { key: "ready_to_ship", label: "待发货", description: "准备发货" },
  { key: "shipped", label: "已发货", description: "已发出" },
];

export function ProductionStepper({ currentStatus, onStatusChange, disabled = false }: ProductionStepperProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const currentStepIndex = steps.findIndex(step => step.key === currentStatus);

  const handleStepClick = async (status: ProductionStatus) => {
    if (disabled || isUpdating) return;
    
    setIsUpdating(true);
    try {
      await onStatusChange(status);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>生产进度</CardTitle>
        <CardDescription>点击步骤更新生产状态</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isClickable = !disabled && !isUpdating;

            return (
              <div key={step.key} className="flex items-start gap-4">
                {/* 步骤图标 */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => handleStepClick(step.key)}
                    disabled={!isClickable}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all
                      ${isCompleted ? "bg-green-500 text-white" : ""}
                      ${isCurrent ? "bg-blue-500 text-white ring-4 ring-blue-200" : ""}
                      ${!isCompleted && !isCurrent ? "bg-gray-200 text-gray-500" : ""}
                      ${isClickable ? "hover:scale-110 cursor-pointer" : "cursor-not-allowed opacity-60"}
                    `}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </button>
                  {index < steps.length - 1 && (
                    <div className={`w-0.5 h-12 mt-2 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`} />
                  )}
                </div>

                {/* 步骤信息 */}
                <div className="flex-1 pb-8">
                  <h3 className={`font-semibold ${isCurrent ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-600"}`}>
                    {step.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{step.description}</p>
                  {isCurrent && (
                    <div className="mt-2 flex gap-2">
                      {index < steps.length - 1 && (
                        <Button
                          size="sm"
                          onClick={() => handleStepClick(steps[index + 1].key)}
                          disabled={!isClickable}
                        >
                          进入下一步
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
