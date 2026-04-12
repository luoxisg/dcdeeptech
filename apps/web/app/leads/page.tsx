import { LeadsPage } from "@/components/leads-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const normalized = Object.fromEntries(
    Object.entries(resolved).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );
  return <LeadsPage searchParams={normalized} />;
}
