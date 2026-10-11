import { requireAdmin } from "@/lib/auth/auth.service";
import { getUsersListAction } from "@/app/actions/user.actions";
import UsersManager from "./UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentAdmin = await requireAdmin();
  const users = await getUsersListAction();

  return (
    <div className="container py-8">
      <UsersManager users={users} currentUserId={currentAdmin.id} />
    </div>
  );
}
