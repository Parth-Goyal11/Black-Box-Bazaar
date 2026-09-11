import { ListingDetail } from "../_components/ListingDetail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  // Workaround to enable static (IPFS) exports: pre-render one dummy page,
  // real listing ids are fetched client-side at runtime regardless.
  return [{ id: "0" }];
}

const ListingDetailPage = async (props: PageProps) => {
  const { id } = await props.params;
  return <ListingDetail listingId={id} />;
};

export default ListingDetailPage;
