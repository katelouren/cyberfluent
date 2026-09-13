import { notFound } from "next/navigation";
import { MissionPlayer } from "@/components/mission-player";
export default async function MissionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!["daily-standup", "bug-report"].includes(slug)) notFound();
  return (
    <main id="main" className="mission-main">
      <MissionPlayer slug={slug} />
    </main>
  );
}
