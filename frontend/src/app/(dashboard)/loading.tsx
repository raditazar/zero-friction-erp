import { LoadingState } from "@/components/ui/feedback";

export default function DashboardLoading() {
  return (
    <div className="page-shell">
      <LoadingState label="Memuat halaman..." />
    </div>
  );
}
