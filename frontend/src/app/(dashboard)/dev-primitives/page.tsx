"use client";

import React from "react";
import {
  AppDialog,
  AppDialogTrigger,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogBody,
  AppDialogFooter,
  AppDialogClose,
} from "@/components/ui/dialog";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { ReviewDialog } from "@/components/ui/dialogs/review-dialog";
import { SecretRevealDialog } from "@/components/ui/dialogs/secret-reveal-dialog";
import { HelpDialog } from "@/components/ui/dialogs/help-dialog";

function DirtyProtectionTest() {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const isDirty = text.trim().length > 0;

  return (
    <div className="p-4 border border-line rounded-md space-y-4 bg-card">
      <h3 className="font-semibold text-lg text-ink">Dirty Protection Test</h3>
      <p className="text-sm text-ink-soft">
        Isi teks, lalu coba tutup form tanpa submit. Harus muncul peringatan.
      </p>
      <button 
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-info-solid text-white rounded-md hover:bg-info-solid transition-colors"
      >
        Buka Dirty Test
      </button>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Edit Item"
        description="Ubah detail item di bawah ini."
        isDirty={isDirty}
        onSubmit={(e) => {
          e.preventDefault();
          alert("Tersimpan!");
          setOpen(false);
          setText("");
        }}
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink">Nama Item</label>
          <input 
            type="text" 
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-info"
            placeholder="Ketik sesuatu..."
          />
        </div>
      </FormDialog>
    </div>
  );
}

function QuickSubmitTest() {
  const [open, setOpen] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState("");

  return (
    <div className="p-4 border border-line rounded-md space-y-4 bg-card">
      <h3 className="font-semibold text-lg text-ink">Quick Submit Test</h3>
      <p className="text-sm text-ink-soft">
        Tekan Ctrl+Enter atau Cmd+Enter di dalam form untuk submit otomatis.
      </p>
      <button 
        onClick={() => { setOpen(true); setSuccessMsg(""); }}
        className="px-4 py-2 bg-info-solid text-white rounded-md hover:bg-info-solid transition-colors"
      >
        Buka Quick Submit Test
      </button>

      {successMsg && <p className="text-positive text-sm font-medium">{successMsg}</p>}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Catatan Cepat"
        onSubmit={(e) => {
          e.preventDefault();
          setSuccessMsg("Berhasil! Form di-submit menggunakan Ctrl+Enter.");
          setOpen(false);
        }}
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink">Isi Catatan</label>
          <textarea 
            className="w-full px-3 py-2 border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-info"
            placeholder="Ketik di sini dan tekan Ctrl+Enter"
            rows={3}
          />
        </div>
      </FormDialog>
    </div>
  );
}

function SubmitErrorTest() {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  return (
    <div className="p-4 border border-line rounded-md space-y-4 bg-card">
      <h3 className="font-semibold text-lg text-ink">Submit Error Test</h3>
      <p className="text-sm text-ink-soft">
        Submit form untuk mensimulasikan error dari server dengan banner bergetar.
      </p>
      <button 
        onClick={() => { setOpen(true); setError(""); }}
        className="px-4 py-2 bg-negative-solid text-white rounded-md hover:bg-negative-solid transition-colors"
      >
        Buka Error Test
      </button>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Transfer Dana"
        isSubmitting={isSubmitting}
        submitError={error}
        onSubmit={(e) => {
          e.preventDefault();
          setIsSubmitting(true);
          setError("");
          // simulate network request
          setTimeout(() => {
            setIsSubmitting(false);
            setError("Saldo tidak valid");
          }, 600);
        }}
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink">Jumlah Transfer</label>
          <input 
            type="number" 
            className="w-full px-3 py-2 border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-negative"
            placeholder="Masukkan jumlah"
            defaultValue="5000000"
          />
        </div>
      </FormDialog>
    </div>
  );
}

function ConfirmDialogTest() {
  const [openDanger, setOpenDanger] = React.useState(false);
  const [openWarning, setOpenWarning] = React.useState(false);

  return (
    <div className="p-4 border border-line rounded-md space-y-4 bg-card">
      <h3 className="font-semibold text-lg text-ink">ConfirmDialog Test</h3>
      <p className="text-sm text-ink-soft">
        Test variant danger (hold-to-confirm 2 detik) dan warning (normal).
      </p>
      <div className="flex gap-2">
        <button 
          onClick={() => setOpenDanger(true)}
          className="px-4 py-2 bg-negative-solid text-white rounded-md hover:bg-negative-solid transition-colors"
        >
          Danger (Hold)
        </button>
        <button 
          onClick={() => setOpenWarning(true)}
          className="px-4 py-2 bg-caution-solid text-white rounded-md hover:bg-caution-solid transition-colors"
        >
          Warning (Normal)
        </button>
      </div>

      <ConfirmDialog
        open={openDanger}
        onOpenChange={setOpenDanger}
        title="Hapus Data"
        description="Apakah Anda yakin ingin menghapus data ini secara permanen?"
        variant="danger"
        onConfirm={() => {
          alert("Data dihapus!");
          setOpenDanger(false);
        }}
      />

      <ConfirmDialog
        open={openWarning}
        onOpenChange={setOpenWarning}
        title="Peringatan"
        description="Tindakan ini mungkin beresiko. Lanjutkan?"
        variant="warning"
        onConfirm={() => {
          alert("Tindakan dilanjutkan!");
          setOpenWarning(false);
        }}
      />
    </div>
  );
}

function ReviewDialogTest() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="p-4 border border-line rounded-md space-y-4 bg-card">
      <h3 className="font-semibold text-lg text-ink">ReviewDialog Test</h3>
      <p className="text-sm text-ink-soft">
        Simulasi transfer antar dompet (tabular-nums & delta badges) dengan explicit consent.
      </p>
      <button 
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-info-solid text-white rounded-md hover:bg-info-solid transition-colors"
      >
        Review Transfer
      </button>

      <ReviewDialog
        open={open}
        onOpenChange={setOpen}
        title="Review Transfer"
        description="Periksa perubahan saldo berikut sebelum mengkonfirmasi."
        requireExplicitConsent={true}
        items={[
          {
            id: "sender-balance",
            label: "Saldo Pengirim",
            before: 5000000,
            after: 3000000
          },
          {
            id: "receiver-balance",
            label: "Saldo Penerima",
            before: 1000000,
            after: 3000000
          }
        ]}
        onConfirm={() => {
          alert("Transfer disetujui!");
          setOpen(false);
        }}
      />
    </div>
  );
}

function SecretRevealDialogTest() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="p-4 border border-line rounded-md space-y-4 bg-card">
      <h3 className="font-semibold text-lg text-ink">SecretRevealDialog Test</h3>
      <p className="text-sm text-ink-soft">
        Tampilkan kredensial atau rahasia sensitif dengan aman.
      </p>
      <button 
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary transition-colors"
      >
        Reveal Secret
      </button>

      <SecretRevealDialog
        open={open}
        onOpenChange={setOpen}
        title="API Production Key"
        secretValue="sk_live_99x821abc"
      />
    </div>
  );
}

function HelpDialogTest() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="p-4 border border-line rounded-md space-y-4 bg-card">
      <h3 className="font-semibold text-lg text-ink">HelpDialog Test</h3>
      <p className="text-sm text-ink-soft">
        Menu panduan pintasan keyboard dan bantuan kontekstual.
      </p>
      <button 
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-positive-solid text-white rounded-md hover:bg-positive-solid transition-colors"
      >
        Buka Help
      </button>

      <HelpDialog
        open={open}
        onOpenChange={setOpen}
        enableGlobalShortcut={true}
        shortcuts={[
          { id: "s1", title: "Bantuan", category: "Umum", keys: ["?"], description: "Buka menu bantuan ini" },
          { id: "s2", title: "Quick Submit", category: "Pintasan Keyboard", keys: ["Ctrl", "Enter"], description: "Submit form dengan cepat" },
          { id: "s3", title: "Lihat Transaksi", category: "Aturan Keuangan", keys: ["Alt", "T"], description: "Tampilkan tabel transaksi" }
        ]}
      />
    </div>
  );
}

export default function DevPrimitivesPage() {
  const sizes = ["sm", "md", "lg", "xl", "full"] as const;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-4">Dev Primitives Showcase</h1>
        <p className="text-ink-soft">
          This page is used to test and showcase internal UI primitives like AppDialog.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">1. Dialog Sizes</h2>
        <div className="flex flex-wrap gap-4">
          {sizes.map((size) => (
            <AppDialog key={size}>
              <AppDialogTrigger asChild>
                <button className="px-4 py-2 bg-info-solid text-white rounded-md hover:bg-info-solid transition-colors">
                  Open {size.toUpperCase()} Dialog
                </button>
              </AppDialogTrigger>
              <AppDialogContent size={size}>
                <AppDialogHeader>
                  <AppDialogTitle>{size.toUpperCase()} Dialog</AppDialogTitle>
                  <AppDialogDescription>
                    This is a {size} sized dialog for testing purposes.
                  </AppDialogDescription>
                </AppDialogHeader>
                <AppDialogBody>
                  <div className="p-4 bg-paper rounded-md border border-line">
                    <p>Main content for {size} dialog goes here.</p>
                  </div>
                </AppDialogBody>
                <AppDialogFooter>
                  <AppDialogClose asChild>
                    <button className="px-4 py-2 bg-paper-sunk text-ink rounded-md hover:bg-line-strong transition-colors">
                      Cancel
                    </button>
                  </AppDialogClose>
                  <button className="px-4 py-2 bg-info-solid text-white rounded-md hover:bg-info-solid transition-colors">
                    Confirm
                  </button>
                </AppDialogFooter>
              </AppDialogContent>
            </AppDialog>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">2. Long Content (Scrollable Overflow)</h2>
        <AppDialog>
          <AppDialogTrigger asChild>
            <button className="px-4 py-2 bg-info-solid text-white rounded-md hover:bg-info-solid transition-colors">
              Open Long Content Dialog
            </button>
          </AppDialogTrigger>
          <AppDialogContent size="md">
            <AppDialogHeader>
              <AppDialogTitle>Terms and Conditions</AppDialogTitle>
              <AppDialogDescription>
                Please read the following carefully. The header and footer should be sticky.
              </AppDialogDescription>
            </AppDialogHeader>
            <AppDialogBody>
              <div className="space-y-4">
                {Array.from({ length: 40 }).map((_, i) => (
                  <p key={i} className="text-sm text-ink">
                    {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                ))}
              </div>
            </AppDialogBody>
            <AppDialogFooter>
              <AppDialogClose asChild>
                <button className="px-4 py-2 bg-paper-sunk text-ink rounded-md hover:bg-line-strong transition-colors">
                  Decline
                </button>
              </AppDialogClose>
              <button className="px-4 py-2 bg-info-solid text-white rounded-md hover:bg-info-solid transition-colors">
                Accept
              </button>
            </AppDialogFooter>
          </AppDialogContent>
        </AppDialog>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">3. Form Simulation (Mobile Bottom Sheet Test)</h2>
        <AppDialog>
          <AppDialogTrigger asChild>
            <button className="px-4 py-2 bg-positive-solid text-white rounded-md hover:bg-positive-solid transition-colors">
              Open Form Dialog
            </button>
          </AppDialogTrigger>
          <AppDialogContent size="md">
            <AppDialogHeader>
              <AppDialogTitle>Create New Transaction</AppDialogTitle>
              <AppDialogDescription>
                Fill out the form below. On mobile, this should slide up as a bottom sheet.
              </AppDialogDescription>
            </AppDialogHeader>
            <AppDialogBody>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <label htmlFor="amount" className="block text-sm font-medium text-ink">Amount</label>
                  <input
                    type="number"
                    id="amount"
                    className="w-full px-3 py-2 border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-positive"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="category" className="block text-sm font-medium text-ink">Category</label>
                  <select
                    id="category"
                    className="w-full px-3 py-2 border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-positive"
                  >
                    <option>Food & Dining</option>
                    <option>Transportation</option>
                    <option>Utilities</option>
                    <option>Entertainment</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="date" className="block text-sm font-medium text-ink">Date</label>
                  <input
                    type="date"
                    id="date"
                    className="w-full px-3 py-2 border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-positive"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-ink">Notes</label>
                  <textarea
                    id="notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-positive"
                    placeholder="Optional details..."
                  ></textarea>
                </div>
              </form>
            </AppDialogBody>
            <AppDialogFooter>
              <AppDialogClose asChild>
                <button className="px-4 py-2 bg-paper-sunk text-ink rounded-md hover:bg-line-strong transition-colors w-full sm:w-auto">
                  Cancel
                </button>
              </AppDialogClose>
              <button className="px-4 py-2 bg-positive-solid text-white rounded-md hover:bg-positive-solid transition-colors w-full sm:w-auto">
                Save Transaction
              </button>
            </AppDialogFooter>
          </AppDialogContent>
        </AppDialog>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">4. FormDialog Harness</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DirtyProtectionTest />
          <QuickSubmitTest />
          <SubmitErrorTest />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">5. Batch 3 Dialogs (Confirm & Review)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConfirmDialogTest />
          <ReviewDialogTest />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">6. Batch 4 Dialogs (Secret & Help)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SecretRevealDialogTest />
          <HelpDialogTest />
        </div>
      </section>
    </div>
  );
}
