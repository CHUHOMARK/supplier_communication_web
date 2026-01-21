import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Material {
  materialCode: string;
  materialName: string;
  shortage: number;
  suppliers: Array<{
    supplierId: number;
    supplierName: string;
    sharePercentage: number;
  }>;
  totalSharePercentage: number;
}

interface VirtualMaterialListProps {
  materials: Material[];
  onEditShare: (materialCode: string, materialName: string) => void;
  isLoading?: boolean;
}

export default function VirtualMaterialList({
  materials,
  onEditShare,
  isLoading = false,
}: VirtualMaterialListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // 使用虚拟滚动
  const virtualizer = useVirtualizer({
    count: materials.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 每行估计高度
    overscan: 10, // 预加载10行
    measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('jsdom') === -1 ? undefined : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end || 0)
      : 0;

  return (
    <div
      ref={parentRef}
      className="w-full h-[600px] overflow-auto border rounded-lg"
    >
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>物料代码</TableHead>
            <TableHead>物料名称</TableHead>
            <TableHead>缺口</TableHead>
            <TableHead>供应商分配</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paddingTop > 0 && (
            <TableRow>
              <TableCell colSpan={5} style={{ height: `${paddingTop}px` }} />
            </TableRow>
          )}
          {virtualItems.map((virtualItem) => {
            const material = materials[virtualItem.index];
            const totalShare = material.totalSharePercentage;
            const isValid = Math.abs(totalShare - 100) < 0.01;

            return (
              <TableRow key={virtualItem.key} data-index={virtualItem.index}>
                <TableCell className="font-medium">{material.materialCode}</TableCell>
                <TableCell>{material.materialName}</TableCell>
                <TableCell>{material.shortage}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {material.suppliers.map((supplier) => (
                      <div key={supplier.supplierId} className="text-sm">
                        <Badge variant="outline">
                          {supplier.supplierName}: {supplier.sharePercentage}%
                        </Badge>
                      </div>
                    ))}
                    {!isValid && (
                      <div className="text-sm">
                        <Badge variant="destructive">
                          总和: {totalShare.toFixed(1)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditShare(material.materialCode, material.materialName)}
                    disabled={isLoading}
                  >
                    编辑份额
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {paddingBottom > 0 && (
            <TableRow>
              <TableCell colSpan={5} style={{ height: `${paddingBottom}px` }} />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
