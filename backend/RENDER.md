# Deploying the CaseMate API to Render

Create a **Web Service** from this repository and set its Root Directory to `casemate/backend` (or `backend` if that folder is the repository root).

Use these settings:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /api/health
```

Set these environment variables in the Render dashboard:

```text
MONGO_URI=<your Atlas connection string>
JWT_SECRET=<a long random secret>
CLIENT_ORIGINS=https://your-project.vercel.app
GOOGLE_CLIENT_ID=<Google OAuth web client ID>
```

Render provides `PORT` automatically. Do not create or override it. Do not add a trailing `/` to `CLIENT_ORIGINS`. After deployment, place the Render service URL with its `/api` suffix in the Vercel environment variable `REACT_APP_API_URL`, then redeploy the frontend.

CaseMate uses Google-only sign-in. Create a Google OAuth **Web application** client, add the deployed frontend URL (for example `https://your-project.vercel.app`) under **Authorized JavaScript origins**, set its client ID as `GOOGLE_CLIENT_ID` in Render and `REACT_APP_GOOGLE_CLIENT_ID` in Vercel, then redeploy both services. A CaseMate account is created only after Google confirms the email address in the identity token.
