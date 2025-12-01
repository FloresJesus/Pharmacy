// src/app/api/usuarios/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
}

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Types ---
type NewUserBody = {
  nombre_usuario: string;
  nombre_completo: string;
  email?: string | null;
  rol?: string;
  activo?: boolean;
  contrasena: string;
  created_by?: string | null;
  create_auth?: boolean;
};

type UpdateUserBody = {
  id: number;
  nombre_usuario?: string;
  nombre_completo?: string;
  email?: string | null;
  rol?: string;
  activo?: boolean;
  contrasena?: string;
};

// Minimal admin.createUser types (for supabase-js v2)
type AdminCreateUserOptions = {
  email: string;
  password: string;
  email_confirm?: boolean;
};
type AdminCreateUserResponse = {
  data: { user: { id: string; email?: string | null } | null } | null;
  error: { message?: string } | null;
};
interface SupabaseAuthAdmin {
  admin: {
    createUser: (opts: AdminCreateUserOptions) => Promise<AdminCreateUserResponse>;
  };
}

// --- Helpers ---
function getAuthTokenFromHeader(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length !== 2) return null;
  const scheme = parts[0];
  const token = parts[1];
  if (/^Bearer$/i.test(scheme)) return token;
  return null;
}

async function getRequester(req: Request): Promise<{ uid: string | null; email: string | null; error: string | null }> {
  const token = getAuthTokenFromHeader(req);
  if (!token) return { uid: null, email: null, error: "Missing Authorization token (Bearer)" };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { uid: null, email: null, error: "Invalid token" };
  }
  return { uid: data.user.id, email: data.user.email ?? null, error: null };
}

async function isRequesterAdmin(uid: string | null): Promise<boolean> {
  if (!uid) return false;
  const { data, error } = await supabaseAdmin
    .from("usuarios")
    .select("rol")
    .eq("created_by", uid)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("isRequesterAdmin lookup error:", error);
    return false;
  }
  const rol = (data as any)?.rol ?? null;
  return rol === "admin" || rol === "administrador";
}

/** Create auth user using admin.createUser (typed) */
async function createAuthUser(email: string, password: string): Promise<string> {
  const adminAuth = (supabaseAdmin.auth as unknown) as SupabaseAuthAdmin;

  if (!adminAuth || typeof adminAuth.admin?.createUser !== "function") {
    throw new Error("Admin createUser method not available; ensure @supabase/supabase-js v2 is installed.");
  }

  const res = await adminAuth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (res.error) {
    const msg = typeof res.error.message === "string" ? res.error.message : JSON.stringify(res.error);
    throw new Error("Error creating auth user: " + msg);
  }

  const uid = res.data?.user?.id ?? null;
  if (!uid) throw new Error("Auth user created but no uid returned.");
  return uid;
}

// --- Handlers ---

export async function POST(request: Request) {
  try {
    const { uid, error: tokenErr } = await getRequester(request);
    if (tokenErr) return NextResponse.json({ error: tokenErr }, { status: 401 });

    const body = (await request.json()) as Partial<NewUserBody> | null;
    if (!body) return NextResponse.json({ error: "Empty body" }, { status: 400 });

    const nombre_usuario = String(body.nombre_usuario ?? "").trim();
    const nombre_completo = String(body.nombre_completo ?? "").trim();
    const email = body.email ? String(body.email).trim() : null;
    const rol = String(body.rol ?? "vendedor").trim();
    const activo = Boolean(body.activo ?? true);
    const contrasena = String(body.contrasena ?? "");
    const create_auth = Boolean(body.create_auth ?? false);

    if (!nombre_usuario || !nombre_completo) {
      return NextResponse.json({ error: "nombre_usuario y nombre_completo son requeridos" }, { status: 400 });
    }
    if (!contrasena || contrasena.length < 6) {
      return NextResponse.json({ error: "Contraseña inválida (mínimo 6 chars)" }, { status: 400 });
    }

    const requesterIsAdmin = await isRequesterAdmin(uid);
    let finalCreatedBy = uid;
    if (body.created_by && requesterIsAdmin) {
      finalCreatedBy = body.created_by!;
    }

    // optionally create the Auth user first
    let createdAuthUid: string | null = null;
    if (create_auth) {
      if (!email) return NextResponse.json({ error: "Para crear cuenta Auth se requiere email" }, { status: 400 });
      if (!requesterIsAdmin && uid !== finalCreatedBy) {
        return NextResponse.json({ error: "No autorizado para crear cuentas Auth" }, { status: 403 });
      }
      createdAuthUid = await createAuthUser(email, contrasena);
    }

    const hashed = await bcrypt.hash(contrasena, 10);

    const payload: Record<string, unknown> = {
      nombre_usuario,
      nombre_completo,
      email,
      rol,
      activo,
      password_hash: hashed,
      created_by: finalCreatedBy,
    };

    if (createdAuthUid) payload["auth_uid"] = createdAuthUid;

    const resp = await supabaseAdmin.from("usuarios").insert(payload).select().single();
    if (resp.error) {
      console.error("Supabase insert error:", resp.error);
      return NextResponse.json({ error: resp.error.message ?? resp.error }, { status: 500 });
    }

    const inserted = resp.data as Record<string, unknown>;
    if ("password_hash" in inserted) delete (inserted as any).password_hash;

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/usuarios error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { uid, error: tokenErr } = await getRequester(request);
    if (tokenErr) return NextResponse.json({ error: tokenErr }, { status: 401 });

    const body = (await request.json()) as Partial<UpdateUserBody> | null;
    if (!body || !body.id) return NextResponse.json({ error: "Missing id in body" }, { status: 400 });
    const id = Number(body.id);

    const requesterIsAdmin = await isRequesterAdmin(uid);

    const { data: existingData, error: eGet } = await supabaseAdmin
      .from("usuarios")
      .select("created_by")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (eGet) {
      console.error("Error checking ownership:", eGet);
      return NextResponse.json({ error: "Error checking ownership" }, { status: 500 });
    }
    if (!existingData) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const ownerUid = (existingData as { created_by?: string | null }).created_by ?? null;
    if (!requesterIsAdmin && ownerUid !== uid) {
      return NextResponse.json({ error: "No autorizado para editar este usuario" }, { status: 403 });
    }

    const payload: Record<string, unknown> = {};
    if (body.nombre_usuario !== undefined) payload.nombre_usuario = String(body.nombre_usuario).trim();
    if (body.nombre_completo !== undefined) payload.nombre_completo = String(body.nombre_completo).trim();
    if (body.email !== undefined) payload.email = body.email ? String(body.email).trim() : null;
    if (body.rol !== undefined) payload.rol = body.rol;
    if (typeof body.activo === "boolean") payload.activo = body.activo;

    if (body.contrasena && typeof body.contrasena === "string" && body.contrasena.trim().length > 0) {
      payload.password_hash = await bcrypt.hash(body.contrasena.trim(), 10);
    }

    const resp = await supabaseAdmin.from("usuarios").update(payload).eq("id", id).select().single();
    if (resp.error) {
      console.error("Supabase update error:", resp.error);
      return NextResponse.json({ error: resp.error.message ?? resp.error }, { status: 500 });
    }

    const updated = resp.data as Record<string, unknown>;
    if ("password_hash" in updated) delete (updated as any).password_hash;
    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err: unknown) {
    console.error("PUT /api/usuarios error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { uid, error: tokenErr } = await getRequester(request);
    if (tokenErr) return NextResponse.json({ error: tokenErr }, { status: 401 });

    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id param" }, { status: 400 });
    const id = Number(idParam);

    const requesterIsAdmin = await isRequesterAdmin(uid);
    if (!requesterIsAdmin) return NextResponse.json({ error: "Solo administradores pueden eliminar usuarios" }, { status: 403 });

    const resp = await supabaseAdmin.from("usuarios").delete().eq("id", id).select().maybeSingle();
    if (resp.error) {
      console.error("Supabase delete error:", resp.error);
      return NextResponse.json({ error: resp.error.message ?? resp.error }, { status: 500 });
    }

    return NextResponse.json({ data: resp.data ?? null }, { status: 200 });
  } catch (err: unknown) {
    console.error("DELETE /api/usuarios error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
