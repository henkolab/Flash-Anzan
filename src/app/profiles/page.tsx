import ProfilesManager from "@/components/ProfilesManager";
import { listProfiles } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profiles · Flash AnZan" };

export default async function ProfilesPage() {
  const profiles = await listProfiles();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Setting profiles</h1>
        <p className="mt-1 text-slate-600">
          Build a profile for each age group or class. Pick one on the play screen before you start presenting.
        </p>
      </div>
      <ProfilesManager profiles={profiles} />
    </div>
  );
}
