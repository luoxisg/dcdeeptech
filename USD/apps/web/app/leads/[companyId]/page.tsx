import { LeadDetailPage } from "@/components/lead-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return <LeadDetailPage companyId={companyId} />;
}
