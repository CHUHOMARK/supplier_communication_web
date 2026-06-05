import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import SupplierManagement from "@/components/SupplierManagement";
import { ArrowLeft, Users, LogOut, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { NotificationCenter } from "@/components/NotificationCenter";

export default function Suppliers() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const handleMappingComplete = () => {
    // 映射完成后跳转到份额分配页面
    setLocation("/share-allocation");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 顶部导航栏 */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回仪表盘
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">供应商管理</h1>
                <p className="text-sm text-gray-500">管理供应商信息，配置邮箱和联系方式</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationCenter />
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              <span>{user?.name || user?.username}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              登出
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <SupplierManagement onMappingComplete={handleMappingComplete} />
        </div>
      </main>
    </div>
  );
}
