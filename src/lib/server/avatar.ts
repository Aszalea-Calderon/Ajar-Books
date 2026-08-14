import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

// Matches BODY_SIZE_LIMIT in docker-compose.yml — keep the two in sync, since
// a raw upload past this is rejected here but one past BODY_SIZE_LIMIT never
// even reaches this code (SvelteKit rejects it at the request layer first).
export const MAX_AVATAR_UPLOAD_BYTES = 8 * 1024 * 1024;

// sharp can decode plenty of formats it'd be surprising to receive as a
// "profile photo" (raw TIFF, HEIF, avif exotica) — allow-listing the
// ordinary photo/web formats keeps this predictable rather than "whatever
// libvips happens to support this build." SVG is deliberately excluded even
// though sharp can rasterize it with librsvg — it's XML, not a photo, and
// there's no reason to add that parser to the attack surface here.
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif']);

const AVATAR_SIZE = 256;

export type UpdateAvatarImageResult = 'ok' | 'too-large' | 'invalid-image';

/**
 * Validates, sanitizes, and stores a user-uploaded avatar photo. The
 * critical property: the stored bytes are never the uploaded file's own
 * bytes — sharp decodes them to raw pixels and re-encodes a brand new PNG
 * from those pixels alone, which is what actually strips embedded scripts,
 * EXIF/XMP/ICC metadata, and any polyglot-file tricks, rather than merely
 * checking the extension or MIME type (both trivially spoofable) and
 * passing the original bytes through. Decode failure (corrupt data, or a
 * non-image file renamed to look like one) surfaces as 'invalid-image'
 * rather than throwing, since sharp's parser is the actual validator here.
 * Always ends up small — a 256×256 PNG — regardless of the original's
 * dimensions, which is also why this is safe to store inline as a data URI
 * rather than needing a separate file-storage path.
 */
export async function updateAvatarImage(
	userId: string,
	fileBuffer: Buffer
): Promise<UpdateAvatarImageResult> {
	if (fileBuffer.byteLength === 0 || fileBuffer.byteLength > MAX_AVATAR_UPLOAD_BYTES) {
		return 'too-large';
	}

	let format: string | undefined;
	try {
		({ format } = await sharp(fileBuffer).metadata());
	} catch {
		return 'invalid-image';
	}
	if (!format || !ALLOWED_FORMATS.has(format)) {
		return 'invalid-image';
	}

	let outputBuffer: Buffer;
	try {
		outputBuffer = await sharp(fileBuffer)
			.rotate() // auto-orient from EXIF before re-encoding discards it
			.resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'attention' })
			.png({ compressionLevel: 9 })
			.toBuffer();
	} catch {
		return 'invalid-image';
	}

	const dataUri = `data:image/png;base64,${outputBuffer.toString('base64')}`;
	await db.update(users).set({ avatarImage: dataUri, avatarEmoji: null }).where(eq(users.id, userId));
	return 'ok';
}
