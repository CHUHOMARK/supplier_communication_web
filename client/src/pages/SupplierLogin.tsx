import { useState } from "react";
import React from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package, KeyRound, Loader2, Shield, Clock, TrendingUp } from "lucide-react";

export default function SupplierLogin() {
  const [supplierCode, setSupplierCode] = useState("");
  const [pin, setPin] = useState("");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const meQuery = trpc.supplierAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // If already logged in, redirect
  if (meQuery.data) {
    setLocation("/supplier-portal");
    return null;
  }

  const loginMutation = trpc.supplierAuth.login.useMutation({
    onSuccess: (data) => {
      toast.success("登录成功");
      utils.supplierAuth.me.invalidate();
      if (data.firstLogin) {
        // Will show PIN change dialog
      } else {
        setLocation("/supplier-portal");
      }
    },
    onError: (error) => {
      toast.error(error.message || "登录失败");
    },
  });

  const changePinMutation = trpc.supplierAuth.changePin.useMutation({
    onSuccess: () => {
      toast.success("PIN码已更新");
      utils.supplierAuth.me.invalidate();
      setForceChangePin(false);
      setLocation("/supplier-portal");
    },
    onError: (error) => {
      toast.error(error.message || "更新失败");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierCode || !pin) {
      toast.error("请输入供应商编号和PIN码");
      return;
    }
    loginMutation.mutate({ supplierCode: supplierCode.trim(), pin });
  };

  const [forceChangePin, setForceChangePin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");

  // Watch for first login after successful login
  const prevDataRef = React.useRef<any>(meQuery.data);
  React.useEffect(() => {
    if ((meQuery.data as any)?.firstLogin && !(prevDataRef.current as any)?.firstLogin) {
      setForceChangePin(true);
    }
    prevDataRef.current = meQuery.data;
  }, [meQuery.data]);

  const handlePinChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      toast.error("PIN码至少4位");
      return;
    }
    if (newPin !== confirmNewPin) {
      toast.error("两次输入的PIN码不一致");
      return;
    }
    changePinMutation.mutate({ oldPin: pin, newPin });
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Left Brand Area */}
      <div className="hidden lg:flex lg:w-3/5 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-400 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 text-center max-w-lg">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <Package className="h-10 w-10 text-blue-300" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">供应商协同平台</h1>
            <p className="text-xl text-blue-200/80">Supplier Collaboration Portal</p>
          </div>
          
          {/* Slogan */}
          <div className="space-y-4 mt-12">
            <div className="flex items-center gap-3 text-blue-100/70">
              <Shield className="h-5 w-5 text-blue-400" />
              <span>安全可靠的供应商登录体系</span>
            </div>
            <div className="flex items-center gap-3 text-blue-100/70">
              <Clock className="h-5 w-5 text-emerald-400" />
              <span>实时交期跟踪与进度汇报</span>
            </div>
            <div className="flex items-center gap-3 text-blue-100/70">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              <span>高效协同，共赢未来</span>
            </div>
          </div>
          
          {/* Footer */}
          <div className="mt-16 text-sm text-blue-200/40">
            <p>如有问题，请联系系统管理员</p>
            <p className="mt-1">技术支持: support@company.com</p>
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Mobile Logo (visible only on small screens) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-500/20 border border-blue-400/30 mb-4">
              <Package className="h-7 w-7 text-blue-300" />
            </div>
            <h2 className="text-xl font-bold text-white">供应商协同平台</h2>
          </div>

          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="space-y-2 pb-4">
              <CardTitle className="text-2xl font-bold text-center text-slate-800">供应商登录</CardTitle>
              <CardDescription className="text-center text-slate-500">
                请输入供应商编号和PIN码以登录系统
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="supplierCode" className="text-slate-700 font-medium">供应商编号</Label>
                  <Input
                    id="supplierCode"
                    type="text"
                    placeholder="例如: SUP-12345"
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="uppercase h-11 text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin" className="text-slate-700 font-medium">PIN码</Label>
                  <Input
                    id="pin"
                    type="password"
                    placeholder="请输入PIN码"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="h-11 text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3 pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 text-base bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> 登录中...</>
                  ) : (
                    <><KeyRound className="h-4 w-4 mr-2" /> 登录</>
                  )}
                </Button>
                <p className="text-xs text-center text-slate-400">
                  首次登录需修改默认PIN码
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>

      {/* First login PIN change dialog */}
      <Dialog open={forceChangePin} onOpenChange={setForceChangePin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>首次登录 - 修改PIN码</DialogTitle>
            <DialogDescription>
              为了您的账户安全，请修改默认PIN码
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePinChange}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newPin">新PIN码</Label>
                <Input
                  id="newPin"
                  type="password"
                  placeholder="至少4位"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  disabled={changePinMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPin">确认新PIN码</Label>
                <Input
                  id="confirmNewPin"
                  type="password"
                  placeholder="再次输入新PIN码"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value)}
                  disabled={changePinMutation.isPending}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={changePinMutation.isPending}>
                {changePinMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> 更新中...</>
                ) : (
                  "确认修改"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
