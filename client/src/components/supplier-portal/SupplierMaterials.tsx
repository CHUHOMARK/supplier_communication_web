import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, AlertTriangle, ClipboardList } from "lucide-react";

export default function SupplierMaterials() {
  const { data, isLoading } = trpc.supplierPortal.getMaterials.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载物料数据...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.plan) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="mt-4 text-gray-500">暂无物料计划数据</p>
          <p className="text-sm text-gray-400 mt-1">请等待采购方发布物料计划</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 计划信息 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">当前物料计划</CardTitle>
            <Badge variant="outline">{data.plan.fileName}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            计划周期：{data.plan.planStartDate} 至 {data.plan.planEndDate}
          </p>
        </CardHeader>
      </Card>

      {/* 物料列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            分配物料列表
            <Badge className="ml-2">{data.materials.length} 个物料</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>物料代码</TableHead>
                  <TableHead>物料名称</TableHead>
                  <TableHead className="text-right">缺数</TableHead>
                  <TableHead className="text-right">份额</TableHead>
                  <TableHead className="text-right">分配缺数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.materials.map((item: any) => (
                  <TableRow key={item.materialCode}>
                    <TableCell className="font-mono text-sm">{item.materialCode}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.materialName}>
                      {item.materialName}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.shortage > 0 ? (
                        <span className="text-red-600 font-medium">{item.shortage}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{item.sharePercentage}%</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.allocatedShortage > 0 ? (
                        <span className="text-orange-600 font-medium">{item.allocatedShortage}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

