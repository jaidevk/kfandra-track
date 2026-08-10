import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { listClubs } from "@/lib/klc/repository";
import { strings } from "@/content/strings";
import { Breadcrumb } from "@/components/breadcrumb";

export const dynamic = "force-dynamic";

export default async function KlcLandingPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/klc");

  const clubs = await listClubs();
  const staff = isStaffRole(player.role);
  const managesAny = clubs.some((c) => c.managerPlayerId === player.id);
  const { klc } = strings;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-5 pb-24">
      <Breadcrumb label={klc.breadcrumb} />
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-tight text-gray-900">
          {klc.landingTitle}
        </h1>
        <p className="mt-1 text-[12px] text-gray-600">
          {staff || managesAny ? klc.landingSubtitle : klc.noClubNote}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {clubs.map((c) => {
          const openable = staff || c.managerPlayerId === player.id;
          const tile = (
            <div
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3 ${
                openable
                  ? "border-gray-200 bg-white active:scale-[0.98]"
                  : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logoPath} alt={c.name} className="h-14 w-14 object-contain" />
              <span className="truncate text-center text-[11px] font-semibold text-gray-800">
                {c.name}
              </span>
              {!openable && <span aria-hidden className="text-[11px] text-gray-400">🔒</span>}
            </div>
          );
          return openable ? (
            <Link key={c.id} href={`/klc/${c.id}`} className="block">
              {tile}
            </Link>
          ) : (
            <div key={c.id} title={klc.lockedNote}>
              {tile}
            </div>
          );
        })}
      </div>
    </div>
  );
}
