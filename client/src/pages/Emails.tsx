import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import EmailGeneration from "@/components/EmailGeneration";
import { ArrowLeft, Mail, LogOut, User } from "lucide-react";
import { Link } from "wouter";
import { NotificationCenter } from "@/components/NotificationCenter";

export default function Emails() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
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
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-600 to-amber-600 flex items-center justify-center">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">生成邮件</h1>
                <p className="text-sm text-gray-500">自动生成供应商通知邮件，支持批量发送</p>
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
          <EmailGeneration />
        </div>
      </main>
    </div>
  );
}
