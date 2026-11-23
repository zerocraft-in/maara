# Public CDN + Private R2 Architecture (Stage 2)

Stage 2 adds a Worker gateway without changing the existing `maara` bucket or moving existing objects.

```text
Admin / Media Manager
  ├─ authenticated upload init → signed R2 PUT
  ├─ public key:  assets/public/{products|banners|content}/{name}
  │    └─ deliveryUrl: https://cdn.maara.co.in/assets/public/...
  └─ private/legacy key: assets/private/... or existing assets/...
       └─ downloadUrl: five-minute signed R2 GET

cdn.maara.co.in → Cloudflare Worker → R2 binding: maara
                   └─ GET/HEAD only, assets/public/* only
```

## Local implementation

- `workers/public-cdn/src/index.ts` is a Worker with a bucket binding named `PUBLIC_MEDIA`.
- The Worker never lists the bucket and never accepts a key from a query parameter.
- Private, legacy, traversal, malformed, missing, and unsupported-method requests are rejected.
- Public responses use trusted R2 metadata, ETag/conditional requests, and immutable caching.
- `apps/admin/src/lib/media-visibility.ts` derives visibility from an explicit server allowlist.
- New `products`, `banners`, and `content` uploads use `assets/public/...`.
- All other new uploads use `assets/private/...`; existing keys remain private.

## Cloudflare steps requiring approval

1. Create a Worker from `workers/public-cdn`, install the reviewed dependencies, and bind the existing bucket `maara` as `PUBLIC_MEDIA`.
2. Add the route `cdn.maara.co.in/*` to this Worker in the `maara.co.in` zone.
3. Provision/verify the `cdn.maara.co.in` DNS record through the Worker route. Do not create an R2 custom-domain bucket route.
4. Keep the R2 public development URL disabled and do not enable direct public bucket access.
5. Configure R2 CORS independently for the signed browser PUT origin(s): `https://admin.maara.co.in` (and a separately approved local/staging origin if needed), methods `GET, HEAD, PUT`, header `Content-Type`, exposed header `ETag`, max age `3600`.

Example commands after Cloudflare approval:

```text
cd workers/public-cdn
npm install
npx wrangler deploy --config wrangler.toml
```

No dashboard, DNS, Worker, R2, Vercel, or production changes were made by Stage 2 implementation.

## Existing media migration plan

Existing records and objects are not classified as public automatically. They continue to use signed GET URLs. A later migration should:

1. inventory records and object metadata read-only;
2. identify product/banner/content references with owner approval;
3. copy each approved object to a unique `assets/public/...` key;
4. verify content type, size, and bytes;
5. update references in a reviewed transaction;
6. verify CDN GET and private denial;
7. retain the old object until rollback and reference checks pass.

No bulk move, rename, deletion, or database migration is part of Stage 2.
