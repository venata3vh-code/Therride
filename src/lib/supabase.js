import { createClient } from "@supabase/supabase-js";
// Public project credentials; every table and upload is protected by server-side RLS.
export const projectUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://abbwqzvlprpjkfmssktf.supabase.co";
export const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_gUmIHpE6Pc32oPakGsLP0g_e-cb-qKD";
export const supabase = createClient(projectUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
export async function adminAccess() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data, error: roleError } = await supabase.rpc("is_store_admin");
  if (roleError || !data) return null;
  return user;
}
export async function loadCatalog() {
  const [p, s] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("store_settings").select("*").eq("id", 1).single(),
  ]);
  if (p.error) throw p.error;
  if (s.error) throw s.error;
  return { products: p.data, settings: s.data };
}
export async function uploadImage(file) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  )
    throw new Error("Избери JPG, PNG, WebP или AVIF изображение.");
  if (file.size > 6 * 1024 * 1024)
    throw new Error("Максималният размер е 6 MB.");
  const suffix = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = "products/" + crypto.randomUUID() + "." + suffix;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return {
    url: supabase.storage.from("product-images").getPublicUrl(path).data
      .publicUrl,
    path,
    alt: "",
    color: "",
  };
}
