# Quick CORS Fix

## Your Current Setup

- Backend: `http://192.168.29.20:5000`
- Frontend: `http://192.168.29.20:4200`

## Solution

### Step 1: Fix Frontend API URL

✅ Already fixed - `apiUrl` now includes `/api` suffix

### Step 2: Add to Backend .env File

Create or edit `back-end/.env` file and add this line:

```env
ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200,http://192.168.29.20:4200
```

**Important:** Make sure:

- No spaces around commas
- Include `http://` protocol
- Include port `:4200`
- Exact match with your frontend URL

### Step 3: Verify .env File Location

Your `.env` file should be here:

```
back-end/.env
```

Same directory as `back-end/package.json`

### Step 4: Restart Backend Server

After adding the line, restart your backend:

1. Stop the server (Ctrl+C)
2. Start again: `npm run dev`

### Step 5: Check Debug Logs

After restart, when you make a request from the frontend, you should see in the backend console:

```
🔍 CORS Check - Origin: http://192.168.29.20:4200
🔍 CORS Check - Allowed Origins: [array of allowed origins]
✅ CORS Match - ...
```

If you see `❌ CORS Rejected`, check:

1. The origin in the log matches exactly what's in your `.env`
2. No extra spaces or typos
3. Server was restarted after changing `.env`

## Complete .env Example

```env
# Database
MONGODB_URI=your_mongodb_uri_here

# JWT
ACCESS_TOKEN_SECRET=your_secret_here
REFRESH_TOKEN_SECRET=your_secret_here
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d

# Server
PORT=5000
NODE_ENV=development

# CORS - Add this line (required for network access)
ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200,http://192.168.29.20:4200
```

## Troubleshooting

If still getting CORS errors after adding to .env:

1. **Check .env file is in correct location** - `back-end/.env`
2. **Check no typos** - Compare with the exact URL from browser console
3. **Restart server** - Environment variables load at startup
4. **Check debug logs** - See what origin is being checked
5. **Verify frontend URL** - Make sure frontend is accessing from `http://192.168.29.20:4200`
