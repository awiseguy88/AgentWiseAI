# Social platforms (to be completed)

Platform | Automated publish? | Auth needed | Notes
---------|-------------------|-------------|------
X / Twitter | no (template only) | OAuth 2 / API v2 | See `src/social/x.ts`
LinkedIn | no | OAuth 2 | -
Instagram | no | Graph API | -
Mastodon | no | Access token | -

## Defaults
- Publishing disabled for all platforms until added to `SOCIAL_ENABLED_PLATFORMS`.
- `publish_social_post` defaults to dry-run unless `confirm: true`.

## Plan per platform
1. Add adapter under `src/social/<id>.ts` implementing `SocialAdapter`.
2. Implement `publish()` using the platform API.
3. Set `publishingEnabled: true` and add `<id>` to `SOCIAL_ENABLED_PLATFORMS`.
