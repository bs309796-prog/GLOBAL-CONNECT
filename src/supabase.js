import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mzdsifpzkkmakikmaghu.supabase.co";

const supabasePublishableKey = sb_publishable_DSwXCiCgTf2lp9xAECzb9A_m_AGqI4q

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
