import Player from "@/components/Player";
import { listProfiles } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const profiles = await listProfiles();
    return <Player profiles={profiles} />;
  } catch {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-10 text-center shadow">
        <h2 className="text-2xl font-bold">Can’t reach the database</h2>
        <p className="mt-2 text-slate-600">
          Check that the Postgres container is running and DATABASE_URL is correct, then reload.
        </p>
      </div>
    );
  }
}
