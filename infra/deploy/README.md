# Deploying to Oracle Cloud Always Free

The whole platform (10 Nest services, Postgres, Redis, Kafka, the three Next.js apps and
Caddy for HTTPS) runs on one **Ampere A1** VM: 4 OCPU / 24 GB RAM / arm64, free with no
time limit.

```
https://<DOMAIN>            storefront     (+ /api/* -> api-gateway)
https://partner.<DOMAIN>    seller console
https://admin.<DOMAIN>      staff console
```

Files: [`docker-compose.prod.yml`](../docker-compose.prod.yml) (production overlay),
[`Dockerfile.frontend`](../Dockerfile.frontend), [`Caddyfile`](../Caddyfile),
[`.env.prod.example`](../.env.prod.example), [`server-setup.sh`](server-setup.sh),
[`deploy.sh`](deploy.sh).

## 1. Create the VM

1. Sign up at <https://www.oracle.com/cloud/free/>. A card is needed for verification only.
   **Choose the home region carefully, because you can't change it later.** If ARM capacity
   is scarce there, a less busy region such as Hyderabad, Mumbai or Singapore may be easier
   than the default.
2. *Compute → Instances → Create instance*
   - Image: **Canonical Ubuntu 24.04** (aarch64)
   - Shape: *Ampere* → **VM.Standard.A1.Flex**, **4 OCPU, 24 GB**
   - Networking: create a VCN with a **public subnet**, and assign a public IPv4
   - SSH keys: upload your public key, or download the generated private key
   - Boot volume: 100–200 GB (the free tier covers 200 GB total)
   - If you see *"Out of host capacity"*, retry later or try another availability domain.
3. *Networking → Virtual cloud networks → your VCN → Security Lists → Default* →
   **Add ingress rules**, source `0.0.0.0/0`:
   - TCP, destination port **80**
   - TCP, destination port **443**
4. Optional but recommended: upgrade the account to **Pay As You Go** (you still pay nothing
   while you stay within Always Free limits). Oracle reclaims idle Always Free VMs on
   free-only accounts.
   Set a budget alert (*Billing → Budgets*) at a small amount, e.g. ₹100.

## 2. Free domain (DuckDNS)

1. Sign in at <https://www.duckdns.org>, create a name such as `nestora`, and set its IP to the
   VM's public IP.
2. `DOMAIN=nestora.duckdns.org`. `partner.nestora.duckdns.org` and `admin.nestora.duckdns.org`
   resolve automatically.

## 3. Prepare the server

```bash
ssh ubuntu@<public-ip>
git clone <your-repo-url> ecommerce && cd ecommerce   # private repo: use a GitHub deploy key or token
bash infra/deploy/server-setup.sh
exit                                                  # re-login so the docker group applies
```

## 4. Configure

```bash
ssh ubuntu@<public-ip> && cd ecommerce
cp infra/.env.prod.example infra/.env.prod
nano infra/.env.prod
```

Fill in `DOMAIN` and `ACME_EMAIL`. Generate the secrets with:

```bash
openssl rand -hex 24      # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_ACCESS_SECRET, and again for JWT_REFRESH_SECRET
```

Also add Razorpay **test** keys. Production refuses the mock payment gateway.

## 5. Deploy

```bash
bash infra/deploy/deploy.sh
```

The first build takes about 15–25 minutes on 4 ARM cores. Then open `https://<DOMAIN>`.
Caddy obtains certificates in the first minute or so.

Useful commands:

```bash
bash infra/deploy/deploy.sh ps
bash infra/deploy/deploy.sh logs -f api-gateway
bash infra/deploy/deploy.sh logs notification-service | grep console   # OTPs when SMS_PROVIDER=console
```

To update after pushing new code: `git pull && bash infra/deploy/deploy.sh`.

## 6. First admin

There is no fixed dev OTP in production. With `SMS_PROVIDER=console`, OTPs appear in the
notification-service log (see above).

1. Sign in on the storefront with your mobile number. This creates the account and its
   profile through the normal flow.
2. Promote that account:

   ```bash
   bash infra/deploy/deploy.sh exec postgres psql -U ecom -d auth_db -c \
     "UPDATE \"Identity\" SET roles = array_append(roles, 'SUPER_ADMIN'::\"Role\")
      WHERE e164 = '+919999999999' AND NOT ('SUPER_ADMIN' = ANY(roles));"
   ```

3. Sign out and sign in again at `https://admin.<DOMAIN>`. The new token carries the role.

## Operations

- **Kafka UI** (not public): `bash infra/deploy/deploy.sh --profile tools up -d kafka-ui`, then
  on your laptop `ssh -L 8080:localhost:8080 ubuntu@<public-ip>` and open <http://localhost:8080>.
- **Backup Postgres**:
  `bash infra/deploy/deploy.sh exec -T postgres pg_dumpall -U ecom | gzip > backup-$(date +%F).sql.gz`
- **Razorpay webhook URL**: `https://<DOMAIN>/api/v1/payments/webhooks/razorpay`
- **Changing `DOMAIN`** requires a rebuild of the frontends (`NEXT_PUBLIC_*` values are baked
  in at build time). `deploy.sh` already rebuilds.
