import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Calendar } from "lucide-react";

export default function SupplierDeliverySchedule() {
  const { data, isLoading } = trpc.supplierPortal.getDeliverySchedule.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载交货计划...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.plan || data.schedule.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Truck className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="mt-4 text-gray-500">暂无交货计划</p>
          <p className="text-sm text-gray-400 mt-1">请等待采购方发布物料计划</p>
        </CardContent>
      </Card>
    );
  }

  // 获取日期范围
  const allDates = new Set<string>();
  data.schedule.forEach((item: any) => {
    if (item.dailySchedule) {
      Object.keys(item.dailySchedule).forEach(date => allDates.add(date));
    }
  });
  const sortedDates = Array.from(allDates).sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              交货计划网格
            </CardTitle>
            <Badge variant="outline">
              {data.plan.planStartDate} 至 {data.plan.planEndDate}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            以下为您负责物料的每日交货量计划
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-3 py-2 text-left font-medium sticky left-0 bg-gray-50 z-10 min-w-[120px]">物料代码</th>
                  <th className="border px-3 py-2 text-left font-medium sticky left-[120px] bg-gray-50 z-10 min-w-[150px]">物料名称</th>
                  {sortedDates.map(date => (
                    <th key={date} className="border px-2 py-2 text-center font-medium whitespace-nowrap min-w-[60px]">
                      {date.slice(5)} {/* 只显示月-日 */}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.schedule.map((item: any) => (
                  <tr key={item.materialCode} className="hover:bg-blue-50/50">
                    <td className="border px-3 py-2 font-mono text-xs sticky left-0 bg-white z-10">
                      {item.materialCode}
                    </td>
                    <td className="border px-3 py-2 text-xs sticky left-[120px] bg-white z-10 truncate max-w-[150px]" title={item.materialName}>
                      {item.materialName}
                    </td>
                    {sortedDates.map(date => {
                      const qty = item.dailySchedule?.[date] || 0;
                      return (
                        <td key={date} className={`border px-2 py-2 text-center text-xs ${qty > 0 ? 'text-blue-700 font-medium bg-blue-50/30' : 'text-gray-300'}`}>
                          {qty > 0 ? qty.toLocaleString() : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
