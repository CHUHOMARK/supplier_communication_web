import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, CheckCircle, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

type ConfirmStatus = "confirmed" | "rejected" | "modified";
type ProductionStatus = "not_started" | "material_prep" | "in_production" | "in_qc" | "ready_to_ship" | "shipped";
type Delivery = { date: string; quantity: number; planQuantity?: number };

const PROD: { key: ProductionStatus; label: string }[] = [
  { key: "not_started", label: "未始" },
  { key: "material_prep", label: "备料" },
  { key: "in_production", label: "生产" },
  { key: "in_qc", label: "质检" },
  { key: "ready_to_ship", label: "待发" },
  { key: "shipped", label: "已发" },
];

function fmt(n: number) { return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + '万' : n.toLocaleString(); }
function fd(d: string) { try { const t = new Date(d); return `${t.getMonth() + 1}/${t.getDate()}`; } catch { return d; } }

export default function SupplierConfirm() {
  const [, params] = useRoute("/confirm/:token");
  const token = params?.token || "";
  const [status, setStatus] = useState<ConfirmStatus>("confirmed");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, Delivery[]>>({});
  const [progress, setProgress] = useState<Record<string, Record<string, ProductionStatus>>>({});

  const { data, isLoading, error } = trpc.confirmation.getByToken.useQuery({ token }, { enabled: !!token });

  const submitMut = trpc.confirmation.submit.useMutation({
    onSuccess: () => { setDone(true); toast.success("提交成功"); },
    onError: (e) => { toast.error(e.message); setSubmitting(false); },
  });
  const modMut = trpc.confirmation.submitModifications.useMutation({
    onSuccess: () => { setDone(true); toast.success("修改提交成功"); },
    onError: (e) => { toast.error(e.message); setSubmitting(false); },
  });
  const progressMut = trpc.confirmation.updateDeliveryProgress.useMutation({
    onSuccess: () => toast.success("进度已更新"),
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const toggle = (code: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  };

  const getSched = (item: any): Delivery[] => edited[item.materialCode] ?? item.deliverySchedule ?? [];

  const getProgress = (code: string, date: string): ProductionStatus => {
    return progress[code]?.[date] || (data as any)?.deliveryProgress?.[`${code}_${date}`] || 'not_started';
  };

  const setItemDateProgress = (code: string, date: string, prodStatus: ProductionStatus) => {
    setProgress(p => ({ ...p, [code]: { ...(p[code] || {}), [date]: prodStatus } }));
    progressMut.mutate({ token, date: `${code}_${date}`, status: prodStatus });
  };

  const updateRow = (code: string, idx: number, field: keyof Delivery, val: string) => {
    setEdited(p => {
      const s = p[code] ?? data?.items.find((i: any) => i.materialCode === code)?.deliverySchedule ?? [];
      const u = [...s]; u[idx] = { ...u[idx], [field]: field === 'quantity' ? Number(val) || 0 : val };
      return { ...p, [code]: u };
    });
  };

  const addRow = (code: string) => {
    setEdited(p => {
      const s = p[code] ?? data?.items.find((i: any) => i.materialCode === code)?.deliverySchedule ?? [];
      return { ...p, [code]: [...s, { date: '', quantity: 0 }] };
    });
  };

  const removeRow = (code: string, idx: number) => {
    setEdited(p => ({ ...p, [code]: (p[code] ?? []).filter((_, i) => i !== idx) }));
  };

  const handleSubmit = () => {
    if (!token) return;
    setSubmitting(true);
    if (status === 'modified') {
      const mods = Object.entries(edited).map(([code, sched]) => {
        const origItem = data?.items.find((i: any) => i.materialCode === code);
        const origSchedule = origItem?.deliverySchedule || [];
        return {
          materialCode: code,
          originalSchedule: Object.fromEntries(origSchedule.filter((s: any) => s.date && s.quantity > 0).map((s: any) => [s.date, s.quantity])),
          modifiedSchedule: Object.fromEntries(sched.filter(s => s.date && s.quantity > 0).map(s => [s.date, s.quantity])),
        };
      });
      // 从逐项进度推导最高生产状态
      const allStatuses = Object.values(progress).flatMap(p => Object.values(p));
      const maxProdIdx = allStatuses.length > 0
        ? Math.max(...allStatuses.map(s => PROD.findIndex(p => p.key === s)).filter(i => i >= 0))
        : 0;
      const derivedProdStatus = PROD[maxProdIdx]?.key || 'not_started';
      modMut.mutate({ token, modifications: mods, productionStatus: derivedProdStatus as any });
    } else {
      submitMut.mutate({ token, status, supplierNotes: notes });
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center p-4"><p className="text-red-600 text-sm">{error.message}</p></div>;
  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="text-center"><CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-2" /><p className="font-medium text-green-700">提交成功</p></div>
    </div>
  );
  if (!data) return null;

  const { confirmation, supplier, plan, items } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold">📋 交期确认</h1>
            <p className="text-xs text-gray-400">{supplier?.name} · {plan?.name}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${confirmation.status === 'pending' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {confirmation.status === 'pending' ? '待确认' : '已确认'}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 py-3 space-y-2">
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="w-6"></th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-500">料号</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-500">名称</th>
                <th className="text-right px-2 py-1.5 font-medium text-gray-500">未交</th>
                <th className="text-center px-2 py-1.5 font-medium text-gray-500">份额</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-500">交货计划</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => {
                const isOpen = expanded.has(item.materialCode);
                const sched = getSched(item);
                const hasQty = item.undeliveredQuantity > 0;

                return (
                  <>
                    <tr key={item.id}
                      className={`border-b cursor-pointer hover:bg-blue-50/50 transition ${isOpen ? 'bg-blue-50/30' : ''} ${!hasQty ? 'opacity-40' : ''}`}
                      onClick={() => toggle(item.materialCode)}>
                      <td className="px-1.5 py-1.5 text-gray-400">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-2 py-1.5 font-mono font-medium whitespace-nowrap">{item.materialCode}</td>
                      <td className="px-2 py-1.5 text-gray-600 max-w-[80px] truncate" title={item.materialName}>{item.materialName}</td>
                      <td className={`px-2 py-1.5 text-right font-bold whitespace-nowrap ${hasQty ? 'text-orange-600' : 'text-green-600'}`}>
                        {hasQty ? fmt(item.undeliveredQuantity) : '✓'}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-500">{item.sharePercentage}%</td>
                      <td className="px-2 py-1.5">
                        {hasQty && sched.length > 0 ? (
                          <span className="text-gray-600">
                            {sched.slice(0, 4).map((d: Delivery, i: number) => (
                              <span key={i}>{i > 0 && <span className="text-gray-300 mx-1">|</span>}<span className="text-gray-400">{fd(d.date)}</span><span className="font-medium text-blue-600 ml-0.5">{fmt(d.quantity)}</span></span>
                            ))}
                            {sched.length > 4 && <span className="text-gray-400 ml-1">+{sched.length - 4}</span>}
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr key={`edit-${item.id}`} className="border-b bg-gray-50/50" onClick={e => e.stopPropagation()}>
                        <td></td>
                        <td colSpan={5} className="px-3 py-2">
                          <div className="space-y-2">
                            {sched.map((d: Delivery, i: number) => {
                              const dateKey = `${item.materialCode}_${d.date}`;
                              const prodStatus = getProgress(item.materialCode, d.date);
                              const prodIdx = PROD.findIndex(s => s.key === prodStatus);

                              return (
                                <div key={i} className="flex items-center gap-2 flex-wrap">
                                  <span className="text-gray-400 text-[10px] w-6">#{i + 1}</span>
                                  <Input type="date" value={d.date} onChange={e => updateRow(item.materialCode, i, 'date', e.target.value)}
                                    className="h-7 text-xs w-36" />
                                  <Input type="number" value={d.quantity} onChange={e => updateRow(item.materialCode, i, 'quantity', e.target.value)}
                                    className="h-7 text-xs w-20 text-right" min={0} />
                                  <div className="flex gap-0.5">
                                    {PROD.map((s, si) => (
                                      <button key={s.key}
                                        onClick={() => setItemDateProgress(item.materialCode, d.date, s.key)}
                                        className={`text-[10px] px-1.5 py-0.5 rounded transition
                                          ${si === prodIdx ? 'bg-blue-500 text-white font-medium' : si < prodIdx ? 'bg-green-100 text-green-600' : 'text-gray-300 hover:text-gray-500'}`}>
                                        {s.label}
                                      </button>
                                    ))}
                                  </div>
                                  <button onClick={() => removeRow(item.materialCode, i)} className="text-gray-300 hover:text-red-500 ml-1">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                            <button onClick={() => addRow(item.materialCode)}
                              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                              <Plus className="h-3 w-3" /> 添加批次
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg border p-3 space-y-2">
          <RadioGroup value={status} onValueChange={(v: any) => setStatus(v)} className="flex gap-3 flex-wrap">
            {[
              { v: 'confirmed', label: '✅ 确认交期' },
              { v: 'modified', label: '✏️ 修改交期' },
              { v: 'rejected', label: '❌ 无法交付' },
            ].map(o => (
              <label key={o.v} className={`flex items-center gap-1.5 px-3 py-1.5 rounded border cursor-pointer text-sm ${status === o.v ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                <RadioGroupItem value={o.v} id={o.v} />
                {o.label}
              </label>
            ))}
          </RadioGroup>
          {status === 'modified' && <p className="text-xs text-blue-600">💡 点击物料行展开后可编辑交货日期和数量</p>}
          <Textarea placeholder="备注（选填）" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs" />
          <Button onClick={handleSubmit} disabled={submitting} className="w-full h-9 text-sm">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '提交确认'}
          </Button>
        </div>
      </div>
    </div>
  );
}
