import { LoadingState } from "@/components/ui/feedback";

export default function DashboardLoading() {
  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
      <LoadingState label="Memuat halaman..." />
    </div>
  );
}
