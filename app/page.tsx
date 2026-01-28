import { createClient } from '@/src/infrastructure/supabase/server';
import { cookies } from 'next/headers'

import { ComponentExample } from "@/components/component-example";

export default async function Page() {
    const supabase = await createClient();

    const { data: todos } = await supabase.from('todos').select()
    console.log(todos);

    return <ComponentExample />;
}