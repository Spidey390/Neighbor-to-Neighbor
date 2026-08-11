# Neighbor-to-Neighbor

Neighbor-to-Neighbor is a senior-care and community-help network that connects residents with verified local volunteers.

## Prerequisites

- Node.js 22 or later
- A Firebase project with Cloud Firestore enabled
- A Firebase Admin service-account key with Firestore read/write access

## Local setup

Clone the repository, install its locked dependencies, and create your local environment file:

```bash
git clone <repository-url>
cd Neighbor-to-Neighbor
npm ci
cp .env.example .env
```

Update `.env` with your own Firebase project and local service-account file:

```env
APP_URL="http://localhost:3000"
FIREBASE_PROJECT_ID="your-firebase-project-id"
GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
```

Download or securely obtain the service-account key and save it as `service-account.json` in the project root. The service account needs the **Cloud Datastore User** role (or an equivalent, appropriately scoped Firestore role) in the Firebase project's Google Cloud IAM settings.

> Never commit `.env` or `service-account.json`. They are already ignored by Git. Share credentials only through an approved secret-management system.

## Seed demo data

After Firebase access is configured, seed the shared database with the demo accounts and initial tasks:

```bash
node src/db/seed.js
```

Run this once for a shared development database. The demo profiles are Jane Doe (resident), Alice Green (volunteer), and Admin Control (admin).

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo login

On the login screen, select one of the sandbox profiles under **"Or Evaluate Sandbox Profiles"**.

## Common Firebase errors

- **"Could not load the default credentials"**: confirm `GOOGLE_APPLICATION_CREDENTIALS` points to an existing `service-account.json` file.
- **"PERMISSION_DENIED: Missing or insufficient permissions"**: grant the service account the **Cloud Datastore User** role, then allow a few minutes for IAM changes to propagate.
