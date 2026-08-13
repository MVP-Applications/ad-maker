import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { failJson, NO_STORE } from "@/lib/api-failure";

/**
 * POST /api/logo — accept a logo the extract could not read off the site.
 *
 * Development only. A Brief's logo has to be a public HTTP URL because the
 * server fetches it before handing it to a model, so an uploaded file needs
 * somewhere to live; here that is the app's own `public/` directory, and the
 * URL it returns is only accepted by the Brief because the same dev-only
 * allowance exists in `parsePublicHttpUrl`. Neither half is on in production,
 * where uploads want real object storage rather than the deployment's disk.
 */
export const runtime = "nodejs";

/** Raster only: the models take a photograph, and SVG is not one. */
const ACCEPTED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return failJson("Logo upload is not available here.", 404);
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return failJson("Send the logo as multipart form data.", 400);
  }

  if (!file) return failJson("No file was sent.", 400);

  const extension = ACCEPTED.get(file.type);
  if (!extension) {
    return failJson("Use a PNG, JPG or WebP image.", 415);
  }
  if (file.size > MAX_BYTES) {
    return failJson("That image is larger than 4 MB.", 413);
  }

  // A generated name, never the one the file arrived with: the upload decides
  // where it is written, and a caller-supplied name decides that for it.
  const name = `${randomUUID()}.${extension}`;
  const directory = path.join(process.cwd(), "public", "uploads");

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, name),
      Buffer.from(await file.arrayBuffer()),
    );
  } catch (cause) {
    console.error("[logo] could not store the upload:", cause);
    return failJson("Couldn't save that image. Try again.", 500);
  }

  // Absolute, because the Brief carries a URL rather than a path.
  const url = new URL(`/uploads/${name}`, req.url).href;
  return NextResponse.json({ url }, { headers: NO_STORE });
}
