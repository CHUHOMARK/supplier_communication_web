import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { DashboardCharts } from "@/components/DashboardCharts";
import { NotificationCenter } from "@/components/NotificationCenter";
import { 
  Upload, 
  Users, 
  PieChart, 
  Mail, 
  BarChart3, 
  Settings,
  LogOut,
  User,
  Database
} from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { data: stats, isLoading } = trpc.dashboard.getStats.useQuery();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const modules = [
    {
      title: "上传物料计划",
      description: "上传Excel文件，系统将自动解析物料信息和计划周期",
      icon: Upload,
      href: "/upload",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "供应商管理",
      description: "管理供应商信息，配置邮箱和联系方式",
      icon: Users,
      href: "/suppliers",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "物料份额分配",
      description: "为多供应商物料分配份额比例",
      icon: PieChart,
      href: "/share-allocation",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "生成邮件",
      description: "自动生成供应商通知邮件，支持批量发送",
      icon: Mail,
      href: "/emails",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "确认监控",
      description: "监控供应商确认状态，查看回复详情",
      icon: BarChart3,
      href: "/monitor",
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "ERP导入",
      description: "导入ERP实际到货数据，对比供应商承诺交期",
      icon: Database,
      href: "/erp-import",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    {
      title: "系统设置",
      description: "配置SMTP邮箱，管理系统参数",
      icon: Settings,
      href: "/settings",
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 顶部导航栏 */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <PieChart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">供应商物料计划沟通工具</h1>
              <p className="text-sm text-gray-500">一站式物料计划和供应商沟通平台</p>
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

      {/* 仪表盘内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来，{user?.name || user?.username}！</h2>
          <p className="text-gray-600">选择下方功能模块开始工作</p>
        </div>

        {/* 功能模块卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.href} href={module.href}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group h-full">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${module.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-6 w-6 ${module.color}`} />
                    </div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      进入模块 →
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* 快速统计 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>物料计划</CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? (
                  <div className="h-9 w-16 bg-gray-200 animate-pulse rounded"></div>
                ) : (
                  stats?.materialPlans || 0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>供应商数量</CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? (
                  <div className="h-9 w-16 bg-gray-200 animate-pulse rounded"></div>
                ) : (
                  stats?.suppliers || 0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>已发送邮件</CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? (
                  <div className="h-9 w-16 bg-gray-200 animate-pulse rounded"></div>
                ) : (
                  stats?.emailsSent || 0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>待确认</CardDescription>
              <CardTitle className="text-3xl text-orange-600">
                {isLoading ? (
                  <div className="h-9 w-16 bg-gray-200 animate-pulse rounded"></div>
                ) : (
                  stats?.pendingConfirmations || 0
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* 数据可视化图表 */}
        <DashboardCharts />
      </main>
    </div>
  );
}
