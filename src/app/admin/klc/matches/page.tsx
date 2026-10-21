import { redirect } from "next/navigation";

/** The recorder moved to /klc/matches so club managers can use it. */
export default function OldMatchesPage() {
  redirect("/klc/matches");
}
