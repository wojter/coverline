# Cloudflare setup

Steps for the tunnel and Access (architecture 3, decision D4). Do them once, in this order. The server has no published ports: all traffic arrives through the tunnel.

## 1. Domain and tunnel

1. Add your domain to Cloudflare (DNS managed by Cloudflare).
2. Zero Trust → Networks → Tunnels → **Create a tunnel** → Cloudflared. Name it `coverline`.
3. Copy the tunnel token into `.env` as `TUNNEL_TOKEN`.
4. Add a public hostname:
   - Subdomain `coverline`, domain `<your domain>`
   - Service: `HTTP`, URL `app:8000` (the compose service name)

## 2. Access applications

Create two self-hosted applications under Zero Trust → Access → Applications.

**API** (`coverline.<domain>/api`)
- Application domain: `coverline.<domain>`, path `/api`.
- Policy: action **Service Auth**, include only the three device tokens (step 3).
- Copy the application's **AUD tag** into `.env` as `CF_ACCESS_AUD`.

**Shell** (`coverline.<domain>`)
- Application domain: `coverline.<domain>`, all paths.
- Policy: action **Bypass**, include everyone. It serves only the static PWA files, never data.
- Access evaluates the more specific path first, so `/api` stays protected.

Turn on **strict service token auth** in the Access settings. Without it, a request with any valid Access token is accepted.

Set `CF_TEAM_DOMAIN` in `.env` to `https://<team>.cloudflareaccess.com` (Zero Trust → Settings → Custom pages, team domain). It must match the JWT `iss`.

## 3. Service tokens (one per device)

Zero Trust → Access → Service auth → **Create service token**, one each:

| Name | Device |
|---|---|
| `coverline-ios` | iPhone |
| `coverline-android` | Android phone |
| `coverline-pc` | PC |

For each token:
- Duration: **1 year**.
- Keep the Client ID and Client Secret. The secret is shown once.
- Enable the expiration alert (Notifications, 30 days before expiry).

Map each Client ID to a device label in `.env`:

```
ALLOWED_SERVICE_TOKENS=<ios client id>.access=ios,<android client id>.access=android,<pc client id>.access=pc
```

The label is what the app shows as the device. Tokens that are not listed are rejected by the server even if Access accepts them.

Each device pastes `<client_id>:<client_secret>` once on the connect screen. On iOS, do this inside the installed app, not in Safari.

## 4. Start and check

```sh
mkdir -p data && sudo chown 10001:10001 data   # the container user writes the database here
docker compose up -d --build
docker compose ps                              # app must be "healthy"
```

Through the tunnel:
- `https://coverline.<domain>/` → 200 (the shell).
- `https://coverline.<domain>/api/me` without a token → 401 or 403.
- `https://coverline.<domain>/api/me` with `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers from a token → 200 and `{"device": "<label>"}`.

## 5. Revoking a device

Zero Trust → Access → Service auth → revoke that token. Its data is not deleted. The device shows the token banner on its next sync.
