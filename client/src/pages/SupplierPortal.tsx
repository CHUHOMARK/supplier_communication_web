import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Package, ClipboardList, Truck, Factory, Bell, Settings, LogOut, CheckCircle, Clock, AlertTriangle, XCircle
} from "lucide-react";
import SupplierMaterials from "@/components/supplier-portal/SupplierMaterials";
import SupplierDeliverySchedule from "@/components/supplier-portal/SupplierDeliverySchedule";
import SupplierProgress from "@/components/supplier-portal/SupplierProgress";
import SupplierMessages from "@/components/supplier-portal/SupplierMessages";
import SupplierSettings from "@/components/supplier-portal/SupplierSettings";

const TAB_MAP: Record<string, string> = {
  materials: 'materials',
  schedule: 'schedule',
  progress: 'progress',
  messages: 'messages',
  settings: 'settings',
  'change-pin': 'settings',
};

export default function SupplierPortal() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/supplier-portal/:tab");
  const urlTab = params?.tab ? (TAB_MAP[params.tab] || 'materials') : 'materials';
  const [activeTab, setActiveTab] = useState(urlTab);
  
  const { data: supplierInfo, isLoading } = trpc.supplierAuth.me.useQuery(undefined, {
    staleTime: 0, // 不缓存，确保每次获取最新数据
  });
  const { data: unreadCount } = trpc.supplierPortal.getUnreadCount.useQuery(undefined, {
    staleTime: 60 * 1000,
    enabled: !!supplierInfo,
  });
  
  const logoutMutation = trpc.supplierAuth.logout.useMutation({
    onSuccess: () => {
      toast.success("已退出登录");
      setLocation("/supplier-login");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!supplierInfo) {
    setLocation("/supplier-login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">供应商门户</h1>
                <p className="text-xs text-gray-500">{supplierInfo.supplierName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                {supplierInfo.supplierCode}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                className="text-gray-500 hover:text-red-600"
              >
                <LogOut className="w-4 h-4 mr-1" />
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="materials" className="flex items-center gap-1">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">物料查看</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">交货计划</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-1">
              <Factory className="w-4 h-4" />
              <span className="hidden sm:inline">生产进度</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="relative flex items-center gap-1">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">消息</span>
              {unreadCount && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">设置</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materials">
            <SupplierMaterials />
          </TabsContent>
          
          <TabsContent value="schedule">
            <SupplierDeliverySchedule />
          </TabsContent>
          
          <TabsContent value="progress">
            <SupplierProgress />
          </TabsContent>
          
          <TabsContent value="messages">
            <SupplierMessages />
          </TabsContent>
          
          <TabsContent value="settings">
            <SupplierSettings supplierInfo={supplierInfo} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
