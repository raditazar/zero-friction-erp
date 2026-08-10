import * as Dialog from "@radix-ui/react-dialog";
import type { Transaction } from "@/lib/api";
import { amount } from "./formatters";

export function AllocationDialog({
  open,
  transaction,
  onOpenChange,
  onConfirm,
  busy,
}: {
  open: boolean;
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const value = Number(transaction?.amount ?? 0);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[#1B2326]/78" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#F5FEFD]/10 bg-[#1B2326] p-5 text-[#F5FEFD] outline-none">
          <Dialog.Title className="section-title">Route ad-hoc income first</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[#F5FEFD]/62">
            Preview alokasi wajib sebelum income masuk ke saldo siap belanja.
          </Dialog.Description>
          <div className="mt-5 rounded-lg border border-[#F5FEFD]/8 bg-[#202A2D] p-4">
            <div className="flex justify-between text-sm">
              <span>Ready to spend</span>
              <span>{amount(value * 0.5)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-[#273538]/90">
              <div className="h-full w-1/2 bg-[#7DD3FC]" />
            </div>
            <div className="mt-5 flex justify-between text-sm">
              <span>Saving / investment</span>
              <span>{amount(value * 0.5)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-[#273538]/90">
              <div className="h-full w-1/2 bg-[#F6C177]" />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close className="btn-secondary">Cancel</Dialog.Close>
            <button disabled={busy} className="btn-primary" onClick={onConfirm}>
              Confirm allocation
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
