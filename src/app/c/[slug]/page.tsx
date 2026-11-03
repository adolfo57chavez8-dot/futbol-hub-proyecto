import { notFound } from "next/navigation";
import { getComp } from "@/lib/competitions";
import CompetitionView from "@/components/CompetitionView";

export default function Page({ params }: { params: { slug: string } }) {
  const comp = getComp(params.slug);
  if (!comp) notFound();
  return <CompetitionView slug={comp.slug} />;
}
