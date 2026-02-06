import { ComponentExample } from "@/components/component-example";
import { createClient } from "@/infrastructure/supabase/server";

export default async function Page() {
  const supabase = await createClient();

  const { data: todos } = await supabase.from("todos").select();
  console.log(todos);

  return <ComponentExample />;
}
