import type { FabricThemeEnvelope } from "@yunari/renderer-core";
import {
  DASHBOARD_THEME_KIND,
  validateFabricThemeEnvelope,
} from "@yunari/renderer-core";
import { MAX_ARCHIVE_BYTES } from "@yunari/theme-package";
import { sessionOf, type Session } from "../auth/session.js";
import { itemById, latestVersion } from "../db/items.js";
import { authorQuotaExceeded, presignAllowed } from "../db/quota.js";
import type { ItemRow, VersionRow } from "../db/types.js";
import type { Env } from "../env.js";
import { packageKey } from "../storage/keys.js";
import { presignPut } from "../storage/presign.js";
import { planVersion } from "../version/plan.js";

const ITEMS_PREFIX = "/api/me/items/";
/** The spec's upload window; the object is signed, never buffered, by us. */
const UPLOAD_EXPIRY_SECONDS = 900;

/**
 * The author's own half of the store. Returns `undefined` for a path this
 * module does not own, leaving the Worker's default 404 in place.
 *
 * A version request never names an R2 key: the key is derived from the
 * envelope's id and the version the Worker computed from the stored baseline.
 */
export async function handleMe(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | undefined> {
  if (!url.pathname.startsWith(ITEMS_PREFIX)) return undefined;
  const parts = url.pathname.slice(ITEMS_PREFIX.length).split("/");
  if (parts.length !== 2) return undefined;
  const itemId = parts[0];
  const action = parts[1];
  if (itemId === undefined || itemId.length === 0 || action === undefined)
    return undefined;

  if (action === "baseline" && request.method === "GET")
    return baseline(request, env, itemId);
  if (action === "versions" && request.method === "POST")
    return requestVersion(request, env, itemId);
  return undefined;
}

/** `{ version, createdAt, envelope, status }` for any state, or 404. */
async function baseline(
  request: Request,
  env: Env,
  itemId: string,
): Promise<Response> {
  const session = await sessionOf(request, env);
  if (session === undefined) return unauthorized();

  const item = await ownedItem(env, session, itemId);
  if (item === undefined) return notFound();
  const version = await latestVersion(env.DB, itemId);
  if (version === undefined) return notFound();

  return Response.json({
    version: version.version,
    createdAt: version.created_at,
    envelope: parseEnvelope(version),
    status: item.status,
  });
}

/** `{ version, status, uploadUrl }`: the validated version, signed PUT. */
async function requestVersion(
  request: Request,
  env: Env,
  itemId: string,
): Promise<Response> {
  const session = await sessionOf(request, env);
  if (session === undefined) return unauthorized();

  const body = await readBody(request);
  if (body === undefined)
    return badRequest("A JSON body with an envelope and a name is required.");

  const validated = validateFabricThemeEnvelope(body["envelope"]);
  if (!validated.ok)
    return badRequest(validated.issues.map((issue) => issue.message).join(" "));
  const envelope = validated.envelope;

  // The path is not authority: a mismatch would let a client sign one item's
  // key while naming another item in the request.
  if (envelope.id !== itemId) {
    return badRequest(
      `The path names item "${itemId}" but the envelope's id is "${envelope.id}".`,
    );
  }

  const item = await itemById(env.DB, envelope.id);
  if (item !== undefined && item.author_user_id !== session.userId)
    return notFound();
  if (item?.status === "removed") {
    return new Response(
      item.status_reason ?? "This item was removed from the store.",
      { status: 409 },
    );
  }

  const name = body["name"];
  let newItemName: string | undefined;
  if (item === undefined) {
    if (!isNonEmptyString(name))
      return badRequest("A name is required for a new item.");
    newItemName = name;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const plan = planVersion({
    previous: await previousEnvelope(env, envelope.id),
    candidate: envelope,
    now: nowIso,
  });
  if (!plan.ok) return badRequest(plan.message);

  // Cheapest refusals first: nothing below this line may run for a red request,
  // and the presign count is only spent once every other check has passed.
  const exceeded = await authorQuotaExceeded(
    env.DB,
    session.userId,
    MAX_ARCHIVE_BYTES,
    item === undefined,
  );
  if (exceeded === "items")
    return tooMany("An account may own at most 20 items.");
  if (exceeded === "bytes")
    return tooMany("An author's stored packages may total at most 1 GiB.");
  if (!(await presignAllowed(env.DB, session.userId, now)))
    return tooMany("Too many upload requests; try again in an hour.");

  if (newItemName !== undefined)
    await createDraft(env, envelope, session.userId, newItemName, nowIso);

  await env.DB.prepare(
    `INSERT INTO presign_event (user_id, at, item_id, version, envelope_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      session.userId,
      nowIso,
      envelope.id,
      plan.version,
      JSON.stringify(envelope),
    )
    .run();

  const uploadUrl = await presignPut({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    key: packageKey(envelope.id, plan.version),
    expiresSeconds: UPLOAD_EXPIRY_SECONDS,
  });

  return Response.json({
    version: plan.version,
    status: (await isVerified(env.DB, session.userId)) ? "published" : "pending",
    uploadUrl,
  });
}

/** A foreign item is indistinguishable from a missing one. */
async function ownedItem(
  env: Env,
  session: Session,
  itemId: string,
): Promise<ItemRow | undefined> {
  const item = await itemById(env.DB, itemId);
  if (item === undefined || item.author_user_id !== session.userId)
    return undefined;
  return item;
}

/** The latest stored version in any state is the ladder's baseline. */
async function previousEnvelope(
  env: Env,
  itemId: string,
): Promise<
  { readonly version: string; readonly envelope: FabricThemeEnvelope } | undefined
> {
  const row = await latestVersion(env.DB, itemId);
  return row === undefined
    ? undefined
    : { version: row.version, envelope: parseEnvelope(row) };
}

/** Written by this Worker from a validated envelope, so the parse is trusted. */
function parseEnvelope(row: VersionRow): FabricThemeEnvelope {
  return JSON.parse(row.envelope_json) as FabricThemeEnvelope;
}

/** Draft is invisible to the public routes until a finalize applies a status. */
async function createDraft(
  env: Env,
  envelope: FabricThemeEnvelope,
  userId: string,
  name: string,
  now: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO item (id, kind, author_user_id, name, status, status_reason,
       created_at, updated_at, published_at, unpublished_at, removed_at,
       downloads, remix_of_id)
     VALUES (?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, NULL, NULL, 0, ?)`,
  )
    .bind(
      envelope.id,
      DASHBOARD_THEME_KIND,
      userId,
      name,
      now,
      now,
      envelope.metadata?.remixOf?.catalogueId ?? null,
    )
    .run();
}

async function isVerified(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT verified FROM author_profile WHERE user_id = ?")
    .bind(userId)
    .first<{ verified: number }>();
  return row?.verified === 1;
}

async function readBody(
  request: Request,
): Promise<Record<string, unknown> | undefined> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return undefined;
  }
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

function badRequest(message: string): Response {
  return new Response(message, { status: 400 });
}

function tooMany(message: string): Response {
  return new Response(message, { status: 429 });
}
