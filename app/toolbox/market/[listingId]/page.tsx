import rawMarketplaceCatalog from "@/plugins/marketplace.json";
import { MarketplaceDetailPageClient } from "@/components/toolbox/marketplace-detail-page-client";

export function generateStaticParams() {
  return rawMarketplaceCatalog.listings.map((listing) => ({
    listingId: encodeURIComponent(listing.id),
  }));
}

export default async function ToolboxMarketplaceDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  return (
    <MarketplaceDetailPageClient listingId={decodeURIComponent(listingId)} />
  );
}
