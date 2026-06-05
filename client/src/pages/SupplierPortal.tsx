import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Package, ChevronDown, ChevronRight, ChevronUp, Loader2, LogOut,
  Clock, Truck, CheckCircle, AlertCircle, Bell, AlertTriangle,
  TrendingUp, Calendar, FileText,
} from "lucide-react";

const PROD_STATUS: { key: "not_started" | "material_prep" | "in_production" | "in_qc" | "ready_to_ship" | "shipped"; label: string; icon: any; color: string; bg: string; }[] = [
  { key: "not_started", label: "未开始", icon: AlertCircle, color: "text-gray-400", bg: "bg-gray-100" },
  { key: "material_prep", label: "备料中", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
  { key: "in_production", label: "生产中", icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "in_qc", label: "质检中", icon: CheckCircle, color: "text-purple-600", bg: "bg-purple-50" },
  { key: "ready_to_ship", label: "待发运", icon: Truck, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "shipped", label: "已发运", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
];

function fmt(n: number | string) {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return num >= 10000 ? (num / 10000).toFixed(1).replace(/\.0$/, "") + "万" : num.toLocaleString();
}

function formatDate(d: string) {
  try {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } catch {
    return d;
  }
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, subtext, color, trend }: {
  icon: any;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
  trend?: "up" | "down" | "none";
}) {
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {subtext && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                {trend === "down" && <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />}
                {subtext}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color.replace("text-", "bg-").replace("600", "100").replace("500", "100")}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SupplierPortal() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Check auth
  const meQuery = trpc.supplierAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!meQuery.data && !meQuery.isLoading) {
    setLocation("/supplier-login");
    return null;
  }

  const logoutMutation = trpc.supplierAuth.logout.useMutation({
    onSuccess: () => {
      utils.supplierAuth.me.invalidate();
      setLocation("/supplier-login");
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
  };

  // Dashboard stats
  const { data: dashboardStats, isLoading: statsLoading } = trpc.supplierPortal.getDashboardStats.useQuery();
  
  // Materials and confirmations
  const { data: materials, isLoading: materialsLoading } = trpc.supplierPortal.getMaterials.useQuery();
  const { data: confirmations } = trpc.supplierPortal.getConfirmations.useQuery();
  
  // Notifications
  const { data: notifications } = trpc.supplierPortal.getNotifications.useQuery();

  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
  const toggleMaterial = (code: string) => {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const productionStatusMutation = trpc.supplierPortal.updateProductionStatus.useMutation({
    onSuccess: () => {
      toast.success("生产状态已更新");
      utils.supplierPortal.getConfirmations.invalidate();
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  if (meQuery.isLoading || materialsLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          <p className="mt-3 text-sm text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!meQuery.data) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">供应商协同平台</h1>
              <p className="text-xs text-slate-400">{meQuery.data.supplierName} · {meQuery.data.supplierCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifications && notifications.filter(n => !n.isRead).length > 0 && (
              <div className="relative">
                <Bell className="h-5 w-5 text-slate-400" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleOpenProfile} className="text-xs">
              <Settings className="h-3.5 w-3.5 mr-1.5" /> 设置
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={logoutMutation.isPending} className="text-xs">
              <LogOut className="h-3.5 w-3.5 mr-1.5" /> 退出
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑供应商资料</DialogTitle>
            <DialogDescription>
              修改您的供应商编号和默认PIN码。修改后请使用新的编号和PIN码登录。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplierCode">供应商编号</Label>
              <div className="flex gap-2">
                <Input
                  id="supplierCode"
                  value={profileSupplierCode}
                  onChange={(e) => setProfileSupplierCode(e.target.value)}
                  placeholder="请输入供应商编号"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(profileSupplierCode)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">默认PIN码</Label>
              <Input
                id="pin"
                type="password"
                value={profilePin}
                onChange={(e) => setProfilePin(e.target.value)}
                placeholder="至少4位"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pinConfirm">确认PIN码</Label>
              <Input
                id="pinConfirm"
                type="password"
                value={profilePinConfirm}
                onChange={(e) => setProfilePinConfirm(e.target.value)}
                placeholder="再次输入PIN码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>取消</Button>
            <Button onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Stats Cards */}
        {dashboardStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={FileText}
              label="待确认物料"
              value={dashboardStats.pendingConfirmations}
              subtext="项待确认"
              color="text-amber-600"
            />
            <StatCard
              icon={Calendar}
              label="即将交货"
              value={dashboardStats.upcomingCount}
              subtext={dashboardStats.earliestDelivery ? `最早: ${formatDate(dashboardStats.earliestDelivery)}` : "暂无"}
              color="text-blue-600"
            />
            <StatCard
              icon={TrendingUp}
              label="本月完成率"
              value={`${dashboardStats.completionRate}%`}
              subtext={`${dashboardStats.confirmedCount}/${dashboardStats.totalConfirmations} 已确认`}
              color="text-emerald-600"
            />
          </div>
        )}

        {/* Notifications */}
        {notifications && notifications.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-500" />
                消息通知
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {notifications.slice(0, 5).map((notif: any) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${notif.isRead ? 'bg-slate-50' : 'bg-blue-50 border border-blue-100'}`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-full ${notif.isRead ? 'bg-slate-200' : 'bg-blue-200'}`}>
                      {notif.type === 'plan_issued' ? (
                        <FileText className={`h-3.5 w-3.5 ${notif.isRead ? 'text-slate-500' : 'text-blue-600'}`} />
                      ) : (
                        <CheckCircle className={`h-3.5 w-3.5 ${notif.isRead ? 'text-slate-500' : 'text-blue-600'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{notif.title}</p>
                      <p className="text-xs text-slate-500">{notif.content}</p>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="materials" className="space-y-4">
          <TabsList className="bg-white shadow-sm border-0">
            <TabsTrigger value="materials">📋 物料清单</TabsTrigger>
            <TabsTrigger value="confirmations">📊 确认记录</TabsTrigger>
          </TabsList>

          {/* Materials Tab */}
          <TabsContent value="materials" className="space-y-3">
            {!materials || materials.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center text-slate-400 text-sm">
                  暂无分配的物料
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">我的物料</CardTitle>
                  <CardDescription className="text-xs">
                    共 {materials.length} 项物料，点击展开查看交货计划并汇报生产进度
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="text-left">料号</TableHead>
                        <TableHead className="text-left">名称</TableHead>
                        <TableHead className="text-right">缺数</TableHead>
                        <TableHead className="text-center">份额</TableHead>
                        <TableHead className="text-left">交货计划</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((item: any) => {
                        const isOpen = expandedMaterials.has(item.materialCode);
                        const schedule = item.dailySchedule || {};
                        const entries = Object.entries(schedule).slice(0, 4);
                        const hasShortage = parseFloat(item.shortage || "0") > 0;

                        return (
                          <>
                            <TableRow
                              key={item.materialCode}
                              className={`cursor-pointer hover:bg-blue-50/50 ${!hasShortage ? 'opacity-50' : ''}`}
                              onClick={() => toggleMaterial(item.materialCode)}
                            >
                              <TableCell>
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-medium">{item.materialCode}</TableCell>
                              <TableCell className="text-xs text-slate-600 max-w-[120px] truncate">{item.materialName}</TableCell>
                              <TableCell className={`text-right text-xs font-bold ${hasShortage ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {hasShortage ? fmt(item.shortage) : "✓"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-xs">{item.sharePercentage}%</Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {entries.length > 0 ? (
                                  <span className="text-slate-500">
                                    {entries.map(([date, qty]: [string, any], i: number) => (
                                      <span key={i}>
                                        {i > 0 && <span className="text-slate-300 mx-1">|</span>}
                                        <span className="text-slate-400">{formatDate(date)}</span>
                                        <span className="font-medium text-blue-600 ml-0.5">{fmt(qty)}</span>
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </TableCell>
                            </TableRow>

                            {isOpen && (
                              <TableRow key={`detail-${item.materialCode}`} className="bg-slate-50/50">
                                <TableCell colSpan={6} className="px-4 py-3">
                                  <div className="space-y-3">
                                    <p className="text-xs text-slate-500 font-medium">计划周期: {item.planStartDate} ~ {item.planEndDate}</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                      {Object.entries(schedule).map(([date, qty]: [string, any]) => (
                                        <div key={date} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2 text-xs shadow-sm">
                                          <span className="text-slate-400">{formatDate(date)}</span>
                                          <span className="font-semibold text-blue-600">{fmt(qty)}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                                      💡 点击物料行可展开查看完整交货计划
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Confirmations Tab */}
          <TabsContent value="confirmations" className="space-y-3">
            {!confirmations || confirmations.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center text-slate-400 text-sm">
                  暂无确认记录
                </CardContent>
              </Card>
            ) : (
              confirmations.map((conf: any) => (
                <ConfirmationCard key={conf.id} confirmation={conf} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ConfirmationCard({ confirmation }: { confirmation: any }) {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<"not_started" | "material_prep" | "in_production" | "in_qc" | "ready_to_ship" | "shipped">(confirmation.productionStatus || "not_started");
  const [isOpen, setIsOpen] = useState(false);

  const statusMutation = trpc.supplierPortal.updateProductionStatus.useMutation({
    onSuccess: () => {
      toast.success("状态已更新");
      utils.supplierPortal.getConfirmations.invalidate();
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const handleStatusChange = (newStatus: "not_started" | "material_prep" | "in_production" | "in_qc" | "ready_to_ship" | "shipped") => {
    setStatus(newStatus);
    statusMutation.mutate({ confirmationId: confirmation.id, productionStatus: newStatus });
  };

  const currentStatus = PROD_STATUS.find(s => s.key === status) || PROD_STATUS[0];
  const Icon = currentStatus.icon;

  const dailySchedule = confirmation.dailySchedule ? (typeof confirmation.dailySchedule === 'string' ? JSON.parse(confirmation.dailySchedule) : confirmation.dailySchedule) : {};

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
      <div
        className="cursor-pointer p-4 hover:bg-slate-50/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${currentStatus.bg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${currentStatus.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">{confirmation.planName || `计划 #${confirmation.planId}`}</p>
              <p className="text-xs text-slate-400">
                {confirmation.status === "pending" ? "待确认" : confirmation.status === "confirmed" ? "已确认" : confirmation.status === "modified" ? "已修改" : confirmation.status}
                {confirmation.confirmedAt ? ` · ${new Date(confirmation.confirmedAt).toLocaleDateString()}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${currentStatus.bg} ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </div>
      </div>
      
      {isOpen && (
        <div className="px-4 pb-4 border-t pt-3 space-y-3">
          {/* Production Status */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">生产状态</p>
            <div className="flex gap-1.5 flex-wrap">
              {PROD_STATUS.map(s => {
                const SI = s.icon;
                const isActive = status === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => handleStatusChange(s.key)}
                    disabled={statusMutation.isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition
                      ${isActive ? `${s.bg} ${s.color} font-medium ring-1 ring-current shadow-sm` : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}
                  >
                    <SI className="h-3.5 w-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily Schedule */}
          {Object.keys(dailySchedule).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">交货计划</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {Object.entries(dailySchedule).map(([date, qty]: [string, any]) => (
                  <div key={date} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-slate-400">{formatDate(date)}</span>
                    <span className="font-semibold text-blue-600">{fmt(qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supplier Notes */}
          {confirmation.supplierNotes && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">备注</p>
              <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{confirmation.supplierNotes}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
