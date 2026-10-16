import { FreeAgencyMarketScreen } from "@/components/free-agency/market-screen";

interface FreeAgencyPageProps {
  params: Promise<{ gameId: string }>;
}

export default async function FreeAgencyPage({ params }: FreeAgencyPageProps) {
  const { gameId } = await params;
  return <FreeAgencyMarketScreen gameId={gameId} />;
}
