# Deploying jazzlineup.com to AWS

Architecture (defined in `infra/`, deployed with CDK):

```
EventBridge (every 4h) ──▶ Lambda (crawler) ──▶ S3  ◀── CloudFront ◀── visitors
                                                 ▲            ▲
                              web/dist (built React app)   jazzlineup.com
                                                        (Cloudflare CNAME + ACM TLS)
```

No servers. The Lambda writes `events.json` to S3 every 4 hours; the site is
static files on CloudFront; the frontend fetches `/events.json` directly.
Expected cost: <$1/month (everything sits in the AWS free tier).

## 0. One-time prerequisites

**AWS CLI** (skip whatever you already have):

```bash
brew install awscli
```

**Credentials.** In the AWS web console: IAM → Users → Create user (name it
`zach-admin`, no console access needed) → Attach policies directly →
`AdministratorAccess` → create. Then open the user → Security credentials →
Create access key → "Command Line Interface (CLI)". Copy both values, then:

```bash
aws configure
# Access Key ID:     <paste>
# Secret Access Key: <paste>
# Default region:    us-east-1     ← everything deploys here (CloudFront needs its cert in us-east-1)
# Output format:     json
```

Verify: `aws sts get-caller-identity` should print your account ID.

**CDK dependencies + one-time account bootstrap:**

```bash
cd ~/github/jazzlineup/infra
npm install
npx cdk bootstrap        # one-time per AWS account/region; creates CDK's staging bucket
```

## 1. Build the frontend

CDK uploads whatever is in `web/dist`, so build first:

```bash
cd ~/github/jazzlineup
npm install              # first time only (Vite/React)
npm run build:web
```

## 2. Deploy — with one mid-flight DNS step

```bash
cd infra
npx cdk deploy
```

Review the changes it lists (IAM grants etc.) and confirm with `y`.

⚠️ **The deploy will PAUSE at the certificate step** — CloudFormation is
waiting for you to prove you own jazzlineup.com. While it sits there:

1. Open the ACM console (make sure region is **us-east-1**):
   https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates/list
2. Click the pending certificate for jazzlineup.com. You'll see one or two
   **CNAME validation records** (name like `_abc123...jazzlineup.com`, value
   like `_xyz...acm-validations.aws.`).
3. In Cloudflare → jazzlineup.com → DNS → Records, add each one:
   Type **CNAME**, Name = the part before `.jazzlineup.com`, Target = the
   value, Proxy status = **DNS only** (grey cloud — important).
4. Wait a few minutes. ACM flips to "Issued" and `cdk deploy` resumes on its
   own. (It waits for hours, so no rush.)

When the deploy finishes it prints outputs — copy `CloudFrontDomain`
(looks like `d1234abcd.cloudfront.net`) and `CrawlerFunctionName`.

## 3. Point the domain at CloudFront

In Cloudflare → DNS → Records, add (both **DNS only** / grey cloud):

| Type  | Name | Target                    |
| ----- | ---- | ------------------------- |
| CNAME | `@`  | `<CloudFrontDomain>`      |
| CNAME | `www`| `<CloudFrontDomain>`      |

(Cloudflare flattens the apex CNAME automatically. Keep the proxy OFF —
CloudFront is already the CDN, and proxying breaks the ACM cert match.)

## 4. First crawl + verify

The schedule runs every 4 hours, but kick off the first crawl now:

```bash
aws lambda invoke --function-name <CrawlerFunctionName> /tmp/crawl-out.json
cat /tmp/crawl-out.json    # {"events":5xx,"fresh":5xx,"kept":0,"errors":[]}
```

Then visit **https://jazzlineup.com** 🎷 (DNS can take a few minutes the
first time; the `<CloudFrontDomain>` URL works immediately.)

## Day-2 operations

- **Frontend changes:** `npm run build:web && cd infra && npx cdk deploy`
  (also invalidates the CloudFront cache).
- **Crawler changes:** same `cdk deploy` (it ships the `crawler/` directory).
- **Force a crawl:** the `aws lambda invoke` command above.
- **Logs:** CloudWatch → Log groups → `/aws/lambda/<CrawlerFunctionName>` —
  each run logs per-club ok/SUSPECT/FAIL lines and a JSON summary.
- **Tear it all down:** `npx cdk destroy` (bucket included; domain and
  Cloudflare records are untouched).

## Troubleshooting

- `cdk synth` or `cdk deploy` errors before doing anything → paste the error;
  the stack code was written without a local synth check.
- Site loads on `<CloudFrontDomain>` but not jazzlineup.com → Cloudflare
  record still proxied (orange cloud) or DNS not propagated yet.
- `403 Forbidden` from CloudFront right after deploy → the SPA fallback +
  bucket policy can take a minute; also confirm `web/dist` was built before
  deploy.
- Crawler wrote no data → check the Lambda logs; each club logs separately.
