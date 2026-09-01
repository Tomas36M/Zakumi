import { redirect } from "next/navigation";

export default function AdminIndex() {
  redirect("/admin/prospeccion?tab=territorio");
}
