import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Banknote } from "lucide-react";
import { Link } from "wouter";

interface BulkPriceRule {
  id: string;
  sellingPrice: number;
  bulkRate: number;
}

function fmt(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

export default function AdminPriceSheet() {
  const { toast } = useToast();
  const [newSelling, setNewSelling] = useState("");
  const [newBulk, setNewBulk] = useState("");

  const { data: rules = [], isLoading } = useQuery<BulkPriceRule[]>({
    queryKey: ["/api/admin/bulk-price-rules"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ sellingPrice, bulkRate }: { sellingPrice: number; bulkRate: number }) => {
      await apiRequest("PUT", "/api/admin/bulk-price-rules", { sellingPrice, bulkRate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bulk-price-rules"] });
      setNewSelling("");
      setNewBulk("");
      toast({ title: "Saved", description: "Bulk price rule added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save rule.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/bulk-price-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bulk-price-rules"] });
      toast({ title: "Deleted", description: "Rule removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    },
  });

  function handleAdd() {
    const sp = parseInt(newSelling, 10);
    const br = parseInt(newBulk, 10);
    if (!sp || sp <= 0 || !br || br <= 0) {
      toast({ title: "Invalid", description: "Enter valid positive prices.", variant: "destructive" });
      return;
    }
    if (br >= sp) {
      toast({ title: "Invalid", description: "Bulk rate must be less than selling price.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ sellingPrice: sp, bulkRate: br });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Banknote className="w-6 h-6 text-emerald-600" />
              Bulk Price Sheet
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Maps each selling price to a bulk rate — applied automatically when cart hits 5+ items.
            </p>
          </div>
        </div>

        {/* Add new row */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add a price mapping</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-500">Selling Price (₹)</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 999"
                value={newSelling}
                onChange={(e) => setNewSelling(e.target.value)}
                data-testid="input-selling-price"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-500">Bulk Rate (₹)</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 799"
                value={newBulk}
                onChange={(e) => setNewBulk(e.target.value)}
                data-testid="input-bulk-rate"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={saveMutation.isPending}
              data-testid="button-add"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Rules table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-0 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Selling Price</span>
            <span>Bulk Rate</span>
            <span>Discount</span>
            <span></span>
          </div>

          {isLoading ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">Loading…</div>
          ) : rules.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              No rules yet. Add one above.
            </div>
          ) : (
            rules.map((rule) => {
              const discount = Math.round(((rule.sellingPrice - rule.bulkRate) / rule.sellingPrice) * 100);
              return (
                <div
                  key={rule.id}
                  className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-0 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-b-0"
                  data-testid={`row-rule-${rule.id}`}
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{fmt(rule.sellingPrice)}</span>
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{fmt(rule.bulkRate)}</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-3">-{discount}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-red-500"
                    onClick={() => deleteMutation.mutate(rule.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${rule.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
