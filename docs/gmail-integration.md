# Gmail CIMB → Inbox ERP

Backend-only implementation for one owner. Gmail must be the same verified Google
account used to log in to ERP. Supported candidate format: `[CONFIDENTIAL] INCOMING
BI FAST`, from `BIFAST.NOREPLY@cimbniaga.co.id`. All accepted messages create
uncategorized **pending income**, never approved transactions. Own-account transfers
must be corrected during review. Gmail message IDs deduplicate Gmail imports only,
not screenshots or manual transactions.

## Phase status and next gates

| Phase | Available locally | Still requires external evidence |
|---|---|---|
| 1: actual format/environment | Actual local receipt inspected and parsed; synthetic fixture, explicit migration tool, Vercel routing config | Deployed URLs and cloud project |
| 2: parser | MIME plain/HTML, exact IDR decimals, Jakarta dates, fail-closed validation; tests and actual local receipt pass | No remaining local parser gate; confirm live Gmail retrieval in phase 3 |
| 3: OAuth/preview | Owner/session binding, encrypted offline credential, preview/status/disconnect; mocked OAuth tests | Enable Gmail API, consent, preview actual old message |
| 4: draft/manual sync | Atomic insertion, database lease, dedup after rejection/deletion, wallet/account validation; PostgreSQL tests | Select test wallet, explicitly import one old message |
| 5: push/recovery | OIDC validation, Pub/Sub route, watch renewal, bounded pages, expired-cursor recovery | Configure Pub/Sub/Scheduler, prove delivery and renewal live |
| 6: operational verification | Local automated checks and synthetic fixtures | Observe genuine new CIMB mail, latency, disconnect and outage recovery in deployment |

Do not label phases 1, 3, 5 or 6 operationally complete until their external gate
passes. Before each live phase, confirm its configuration and expected result from
this table. No Google Cloud/Vercel changes or production migrations were executed
by the local implementation.

## 1. Validate a local email first

In Gmail, open a receipt → Show original → Download original. Keep that file
outside the repository or under the ignored `.tmp/` directory. Do not paste the
full account number, email body, token, or client secret into chat.

From `backend/`:

```powershell
go run ./cmd/gmail-preview 'D:\private\cimb-receipt.eml'
go run ./cmd/gmail-preview ./internal/gmail/testdata/cimb-synthetic.eml
```

This tool parses format only and **does not verify authenticity** or touch the
database. Its output excludes the account number. The fixture is invented and
cannot prove that a real CIMB message will parse.

The locally supplied receipt was successfully parsed without database writes. It
uses HTML with US-ASCII charset, `DD/MM/YYYY` dates without a time, Indonesian IDR
grouping, and `[CONFIDENTIAL]INCOMING BI FAST` without a space after the bracket.
Both subject variants are accepted; extra subject text is rejected. No personal
receipt values are stored in this documentation or the synthetic fixture.

Current parser supports Indonesian number grouping (`Rp 25.000,00`, `IDR 25000`),
numeric dates `DD/MM/YYYY`, `DD-MM-YYYY`, or `YYYY-MM-DD`, optionally with hours and
minutes/seconds. Date-only values use midnight Jakarta with an explicit date-only
marker. Unsupported or ambiguous fields fail rather than being guessed.

Live preview/import additionally require the topmost `Authentication-Results`
header to originate at `mx.google.com`, with DMARC pass aligned to
`cimbniaga.co.id`. The local receipt's Gmail headers report SPF, DKIM and DMARC
pass; live Gmail retrieval must still verify the policy. Do not weaken it to sender/subject-only matching. Never
use uploaded `.eml` headers as authentication evidence.

## 2. Configure OAuth and storage

Use the **same Google Cloud project as GOOGLE_CLIENT_ID** for the Gmail Pub/Sub
topic. Enable Gmail API. Keep the existing login callback and add a separate web
OAuth callback:

```text
https://WEB_DOMAIN/api/backend/integrations/gmail/callback
```

The frontend's existing backend proxy forwards this route; no new frontend code
is required. Initiate OAuth through that same web domain to keep the ERP session
and state cookies first-party. Ask for Gmail consent separately from normal login.

For development, add only your account as a test user. For sustained personal use,
review the OAuth publishing status and personal-use verification exception:
[Google personal-use exception](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#personal-use),
[OAuth audience and seven-day testing authorizations](https://support.google.com/cloud/answer/15549945).
Publishing to production does not remove other reasons credentials may expire or
be revoked. The app does not implement public onboarding.

Required backend environment (all values below are placeholders):

| Variable | Value |
|---|---|
| `GMAIL_OWNER_EMAIL` | Your Google login/Gmail address; integration fails closed if absent |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Existing web OAuth client |
| `GMAIL_REDIRECT_URL` | Separate callback above |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | Base64 of 32 random bytes; preserve securely across deploys |
| `FRONTEND_URL` | Exact web origin, used to validate browser mutation requests |
| `APP_ENV` | `production` on Vercel for secure cookies |
| `DATABASE_URL` | Existing PostgreSQL pooled URL with provider-required SSL |

Generate an encryption key into the clipboard without printing it:

```powershell
$gmailKeyBytes = New-Object byte[] 32
$gmailRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$gmailRng.GetBytes($gmailKeyBytes)
$gmailRng.Dispose()
Set-Clipboard ([Convert]::ToBase64String($gmailKeyBytes))
```

Paste into Vercel's protected environment settings and save securely. Losing the
key requires reconnecting Gmail and reconfiguring the recipient account. Do not
replace it on every deployment. OAuth tokens and expected recipient account are
encrypted with separate purposes and owner binding.

Apply the migration explicitly after checking the target database and making a
backup. Set `DATABASE_URL` in the shell privately; the tool never loads `.env`:

```powershell
go run ./cmd/migrate-gmail ../database/migrations/007_gmail_integration.sql
```

The migration requires the existing ERP schema, is transactional, records its
checksum, and supports repeat verification. Never reset the database. New Gmail
tables are intentionally absent from the best-effort startup bootstrap.

## 3. Preview, then one test draft

1. Log into ERP normally. Open
   `https://WEB_DOMAIN/api/backend/integrations/gmail/connect` in that browser.
2. Grant Gmail read-only access. Callback returns `connected`; no mail is imported.
3. Call `GET /messages` through ERP to obtain candidate Gmail message IDs without
   exposing the Google token. A browser URL/thread ID is not necessarily a message
   ID. The response includes up to ten candidate IDs and a next-page token; candidates
   have not yet passed authenticity/parser checks.
4. Call `POST /preview` with `{"message_id":"GMAIL_MESSAGE_ID"}`. Confirm the
   amount, date, sender/bank and masked account against your email.
5. Create a clearly named test wallet, initial balance zero. Configure it below
   with `enabled=false`, `test_mode=true`, and the exact recipient account from
   the email. Use an authenticated local REST client or the existing same-origin
   proxy; do not embed credentials in source or screenshots.
6. Call `POST /import` for that one ID. It must appear once in inbox, labelled
   `UJI ERP`, with no balance change. Repeat import to prove deduplication.

```json
{
  "wallet_id": "TEST_WALLET_UUID",
  "recipient_account": "YOUR_EXACT_RECIPIENT_ACCOUNT",
  "enabled": false,
  "test_mode": true
}
```

Settings account must match the authenticated receipt even in test mode. Test mode
only labels drafts; it does not bypass authenticity or account validation. Do not
approve test drafts. Reject them after inspecting. Imported IDs remain recorded,
so that same email will not later be imported into another wallet.

## 4. Configure authenticated push and scheduler

Enable billing and budget alerts. Free allowances exist, but alerts are not a hard
spending cap: [Pub/Sub pricing](https://cloud.google.com/pubsub/pricing),
[Cloud Scheduler pricing](https://cloud.google.com/scheduler/pricing).

For the following commands, use your actual project and **backend production URL**.
They are instructions for external setup, not commands run by the implementation.
Requires an authenticated `gcloud` CLI and permissions to manage these resources.

```powershell
$gmailProject = 'YOUR_OAUTH_PROJECT_ID'
$gmailApiOrigin = 'https://API_DOMAIN'
$gmailPushUrl = "$gmailApiOrigin/integrations/gmail/push"
$gmailMaintenanceUrl = "$gmailApiOrigin/integrations/gmail/maintenance"
$gmailPushSA = "erp-gmail-push@$gmailProject.iam.gserviceaccount.com"
$gmailSchedulerSA = "erp-gmail-scheduler@$gmailProject.iam.gserviceaccount.com"

gcloud services enable gmail.googleapis.com pubsub.googleapis.com cloudscheduler.googleapis.com --project=$gmailProject
gcloud pubsub topics create erp-gmail --project=$gmailProject
gcloud pubsub topics add-iam-policy-binding erp-gmail --project=$gmailProject --member='serviceAccount:gmail-api-push@system.gserviceaccount.com' --role=roles/pubsub.publisher
gcloud iam service-accounts create erp-gmail-push --project=$gmailProject
gcloud iam service-accounts create erp-gmail-scheduler --project=$gmailProject
gcloud beta services identity create --service=pubsub.googleapis.com --project=$gmailProject
$gmailProjectNumber = gcloud projects describe $gmailProject --format='value(projectNumber)'
gcloud iam service-accounts add-iam-policy-binding $gmailPushSA --project=$gmailProject --member="serviceAccount:service-$gmailProjectNumber@gcp-sa-pubsub.iam.gserviceaccount.com" --role=roles/iam.serviceAccountTokenCreator
gcloud pubsub subscriptions create erp-gmail-push --project=$gmailProject --topic=erp-gmail --push-endpoint=$gmailPushUrl --push-auth-service-account=$gmailPushSA --push-auth-token-audience=$gmailPushUrl --ack-deadline=60
gcloud scheduler jobs create http erp-gmail-maintenance --project=$gmailProject --location=asia-southeast1 --schedule='*/5 * * * *' --time-zone=Asia/Jakarta --uri=$gmailMaintenanceUrl --http-method=POST --oidc-service-account-email=$gmailSchedulerSA --oidc-token-audience=$gmailMaintenanceUrl --attempt-deadline=60s
```

The caller creating the subscription/job needs `iam.serviceAccounts.actAs` for
the selected service accounts. Preserve the Cloud Scheduler service agent's
standard `roles/cloudscheduler.serviceAgent` grant. No service-account private key
is required in the ERP backend.

Set additional backend environment, then redeploy:

| Variable | Value |
|---|---|
| `GMAIL_PUBSUB_TOPIC` | `projects/PROJECT_ID/topics/erp-gmail` |
| `GMAIL_PUBSUB_SUBSCRIPTION` | `projects/PROJECT_ID/subscriptions/erp-gmail-push` |
| `GMAIL_PUSH_AUDIENCE` | Exact production push URL |
| `GMAIL_PUSH_SERVICE_ACCOUNT` | `erp-gmail-push@PROJECT_ID.iam.gserviceaccount.com` |
| `GMAIL_MAINTENANCE_AUDIENCE` | Exact production maintenance URL |
| `GMAIL_MAINTENANCE_SERVICE_ACCOUNT` | `erp-gmail-scheduler@PROJECT_ID.iam.gserviceaccount.com` |

Backend routing is in `backend/vercel.json`, with a 60-second function budget.
Verify production machine URLs reach the JSON handler, not Vercel deployment
protection or a login redirect. An unauthenticated POST should return 401. Do not
disable ERP authentication to make push work.

After test preview/import succeeds, configure the real CIMB wallet with
`test_mode=false`, `enabled=true`. Then call `POST /sync` once to register watch
immediately. Activation starts from the current mailbox position; it does not
bulk-import history. Pausing via settings keeps the cursor and resumes messages
since that cursor. Fully disconnecting clears the activation boundary; reconnect
and enable start a fresh boundary but preserve message deduplication records.

Watch covers the mailbox, including mail archived by existing filters. Only
matching, authenticated CIMB receipts become drafts. Watch renewal does not
overwrite the sync cursor. Pub/Sub deliveries are acknowledged only after bounded
processing; backlog/busy/transient failures return retryable errors. Each request
processes at most ten new messages, persists pagination/outcomes, and completes
within a 45-second processing timeout. No work runs after the HTTP response.
The scheduler catches missed signals and renews watch before expiration.

## API reference

All paths below are under `/integrations/gmail`; browser/API access may use the
existing `/api/backend` proxy. User routes require a valid ERP session or API key
and `GMAIL_OWNER_EMAIL` matching the authenticated user's email, even in development.

| Method/path | Input/result |
|---|---|
| `GET /connect` | Browser OAuth redirect |
| `GET /callback` | Single-use, session/identity-bound state; returns connected |
| `GET /status` | Connection/config flags, counts, last sync/error, latest import delay, recent failed IDs |
| `GET /messages` | Up to ten candidate message IDs; optional `page_token`; no transaction/cursor writes |
| `PUT /settings` | Wallet/account/enabled/test_mode JSON above; `{"enabled":false}` pauses |
| `POST /preview` | `{"message_id":"..."}`; receipt + account last four digits, no transaction/cursor writes |
| `POST /import` | Same body; explicit historic import/retry to configured wallet |
| `POST /sync` | No body; imported/failed/ignored counts and `more` flag |
| `DELETE /connection` | Stop watch, revoke Google grant, remove encrypted credentials |
| `POST /push` | Pub/Sub envelope; verifies Google signature, issuer, expiry, audience, SA email and subscription |
| `POST /maintenance` | Scheduler OIDC identity; recovery sync and watch renewal |

`/status` never returns token/account ciphertext. `reauthorization_required_401`
means reconnect Gmail. Failed parser/auth/account checks are durable message
outcomes visible in recent failures; retry explicitly after correcting the cause.
Temporary Gmail/DB errors do not advance the cursor. An expired history cursor
searches matching receipts since activation and deduplicates before resuming.

Disconnect revokes grants **for the Google Cloud project**, not just Gmail scope;
Google's normal login consent may be requested again later. Existing ERP sessions
are retained. If external stop/revocation fails, local sync is disabled and the
encrypted credential is retained only so disconnect can be retried.

## Validation and rollout

Run from `backend/`:

```powershell
go test ./...
# Opt-in database tests: point only at a disposable LOCAL PostgreSQL database.
$env:GMAIL_TEST_DATABASE_URL = 'postgres://TEST_USER@127.0.0.1:TEST_PORT/TEST_DATABASE?sslmode=disable'
go test ./internal/httpserver -run Gmail -count=1
go vet ./...
```

Database tests use a unique schema and clean it up. They refuse remote hosts and
never use `DATABASE_URL` or the startup schema bootstrap. Database tests are skipped
when the explicit test variable is absent.

Live acceptance checklist:

- Preview one genuine old email without creating a transaction.
- Import it once to a test wallet; duplicate/reject/reimport must not create more drafts.
- Activate real configuration, manually sync once, then inspect watch expiration.
- Send ordinary dummy email to Gmail: push should fire, receipt filter should ignore it.
- Observe one genuine new CIMB email during normal use; compare amount/date and status
  `latest_import.delay_seconds`. Historical test imports have intentionally large delay.
- Run maintenance manually and confirm renewal when watch is due; simulate a missed
  push and prove recovery without duplicate drafts.
- Revoke Gmail access, confirm reconnect status, reconnect, then test full disconnect.
- Run existing backend tests and verify the unchanged login/inbox flows.

Near-immediate delivery is an expectation to measure, not a guaranteed SLA.
Frontend work starts only after actual receipt and cloud-delivery evidence is complete.
