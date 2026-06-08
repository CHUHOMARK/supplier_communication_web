import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Package, Lock, User } from "lucide-react";

export default function SupplierLogin() {
  const [, setLocation] = useLocation();
  const [supplierCode, setSupplierCode] = useState("");
  const [pinCode, setPinCode] = useState("");
  const utils = trpc.useUtils();

  const loginMutation = trpc.supplierAuth.login.useMutation({
    onSuccess: (data) => {
      // 清除所有供应商相关缓存，确保切换账号时显示正确数据
      utils.supplierAuth.me.invalidate();
      utils.supplierPortal.invalidate();
      
      if (data.isFirstLogin) {
        // 首次登录跳转到修改PIN码页面
        setLocation("/supplier-portal/change-pin");
      } else {
        setLocation("/supplier-portal");
      }
      toast.success(`欢迎回来，${data.supplierCode}`);
    },
    onError: (error) => {
      toast.error(`登录失败：${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierCode.trim() || !pinCode.trim()) {
      toast.error("供应商编号和PIN码不能为空");
      return;
    }
    loginMutation.mutate({ supplierCode: supplierCode.trim(), pinCode: pinCode.trim() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo区域 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">供应商门户</h1>
          <p className="text-gray-500 mt-1">物料计划沟通平台</p>
        </div>

        {/* 登录卡片 */}
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">供应商登录</CardTitle>
            <CardDescription>输入您的供应商编号和PIN码登录系统</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplierCode">供应商编号</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="supplierCode"
                    placeholder="例如：S1-001"
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value)}
                    className="pl-10"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinCode">PIN码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="pinCode"
                    type="password"
                    placeholder="请输入PIN码"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="pl-10"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "登录中..." : "登录"}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-sm text-gray-500">
                如需获取账号，请联系您的采购负责人
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 底部链接 */}
        <div className="text-center mt-6">
          <button
            onClick={() => setLocation("/login")}
            className="text-sm text-blue-600 hover:underline"
          >
            管理员登录入口 →
          </button>
        </div>
      </div>
    </div>
  );
}
