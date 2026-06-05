import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Lock, User } from "lucide-react";

interface SupplierSettingsProps {
  supplierInfo: {
    supplierCode: string;
    supplierName: string;
    supplierId: number;
  };
}

export default function SupplierSettings({ supplierInfo }: SupplierSettingsProps) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const changePinMutation = trpc.supplierAuth.changePin.useMutation({
    onSuccess: () => {
      toast.success("PIN码修改成功");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    },
    onError: (error) => {
      toast.error(`修改失败：${error.message}`);
    },
  });

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin || !newPin || !confirmPin) {
      toast.error("请填写所有字段");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("两次输入的新PIN码不一致");
      return;
    }
    if (newPin.length < 6) {
      toast.error("PIN码长度不能少于6位");
      return;
    }
    changePinMutation.mutate({ oldPin: currentPin, newPin });
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* 账号信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            账号信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-500">供应商编号</Label>
            <p className="font-mono text-lg font-medium">{supplierInfo.supplierCode}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">供应商名称</Label>
            <p className="text-lg">{supplierInfo.supplierName}</p>
          </div>
        </CardContent>
      </Card>

      {/* 修改PIN码 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5" />
            修改PIN码
          </CardTitle>
          <CardDescription>定期修改PIN码以保障账号安全</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPin">当前PIN码</Label>
              <Input
                id="currentPin"
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="请输入当前PIN码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPin">新PIN码</Label>
              <Input
                id="newPin"
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="请输入新PIN码（至少6位）"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPin">确认新PIN码</Label>
              <Input
                id="confirmPin"
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="请再次输入新PIN码"
              />
            </div>
            <Button
              type="submit"
              disabled={changePinMutation.isPending}
              className="w-full"
            >
              {changePinMutation.isPending ? "修改中..." : "修改PIN码"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
