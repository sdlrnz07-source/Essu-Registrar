import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "https://mpegqtxwbeuwszowkudu.supabase.co";
const supabaseAnonKey = "sb_publishable_b6BTvkgb04qpwaRVtAofSg_t5xMQzGE";

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
);