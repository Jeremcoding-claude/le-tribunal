import Audience from "@/components/audience/Audience";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Audience source={{ mode: "direct", id }} />;
}
