import { LoadingState } from "@/components/ui/feedback";

export default function DashboardLoading() {
  return (
    <div className="page-shell">
      <LoadingState variant="list" rows={5} label="Memuat halaman" />
    </div>
  );
}
