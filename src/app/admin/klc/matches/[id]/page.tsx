import { redirect } from "next/navigation";

/** The recorder moved to /klc/matches so club managers can use it. */
export default async function OldMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/klc/matches/${id}`);
}
