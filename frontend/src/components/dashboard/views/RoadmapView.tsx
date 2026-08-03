import { roadmapItems } from "../model";
import { Panel } from "@/components/ui/dashboard";

export function RoadmapView() {
  return (
    <Panel>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Disabled until backend is live</p>
          <h3 className="section-title">Roadmap endpoints</h3>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {roadmapItems.map((item) => (
          <div key={item} className="rounded bg-[#F9F8F5]/36 p-4">
            <p className="font-medium text-[#1A1A1A]/74">{item}</p>
            <p className="mt-2 text-sm text-[#1A1A1A]/38">Coming soon</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
