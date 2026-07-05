import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const ALLOWED_FIELDS = new Set(["title", "phone", "avatar_url", "timezone"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isValidTimeZone(value: string) {
  if (!value) return true;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isSafeAvatarUrl(value: string) {
  if (!value) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function projectProfile(user: any) {
  return {
    id: normalizeText(user?.id),
    full_name: normalizeText(user?.full_name),
    email: normalizeText(user?.email),
    title: normalizeText(user?.title),
    phone: normalizeText(user?.phone),
    avatar_url: normalizeText(user?.avatar_url),
    timezone: normalizeText(user?.timezone),
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const profile =
      body?.profile && typeof body.profile === "object" && !Array.isArray(body.profile)
        ? body.profile
        : null;

    if (!profile) {
      return Response.json(
        { ok: false, error: "Provide the profile fields to update." },
        { status: 400 }
      );
    }

    const submittedFields = Object.keys(profile);
    if (submittedFields.length === 0 || submittedFields.some((key) => !ALLOWED_FIELDS.has(key))) {
      return Response.json(
        {
          ok: false,
          error:
            "Only title, phone, avatar, and timezone can be updated from your profile.",
        },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, error: "You must be signed in to update your profile." },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        { ok: false, error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const update: Record<string, string> = {};

    if (Object.prototype.hasOwnProperty.call(profile, "title")) {
      update.title = normalizeText(profile.title).slice(0, 300);
    }
    if (Object.prototype.hasOwnProperty.call(profile, "phone")) {
      update.phone = normalizeText(profile.phone).slice(0, 100);
    }
    if (Object.prototype.hasOwnProperty.call(profile, "avatar_url")) {
      const avatarUrl = normalizeText(profile.avatar_url);
      if (!isSafeAvatarUrl(avatarUrl)) {
        return Response.json(
          { ok: false, error: "Profile image URL is invalid." },
          { status: 400 }
        );
      }
      update.avatar_url = avatarUrl;
    }
    if (Object.prototype.hasOwnProperty.call(profile, "timezone")) {
      const timezone = normalizeText(profile.timezone);
      if (!isValidTimeZone(timezone)) {
        return Response.json(
          { ok: false, error: "Choose a valid timezone." },
          { status: 400 }
        );
      }
      update.timezone = timezone;
    }

    const updated = await base44.asServiceRole.entities.User.update(
      caller.id,
      update
    );

    return Response.json({ ok: true, profile: projectProfile(updated) });
  } catch (error: any) {
    console.error(
      "updateAuthorizedUserProfile error:",
      error?.message || error
    );

    return Response.json(
      { ok: false, error: "Your profile could not be updated. Please try again." },
      { status: 500 }
    );
  }
});
