# CORS Configuration Guide

## Quick Fix for CORS Errors

If you're getting "Not allowed by CORS" errors, add this to your `.env` file:

### Step 1: Create/Edit `.env` file

Create or edit `back-end/.env` file and add:

```env
# Add your frontend URLs here
ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200,http://192.168.29.20:4200
```

**Important:** Replace `192.168.29.20` with your actual network IP if it's different.

### Step 2: Restart the Server

After adding the environment variable, restart your backend server:
```bash
npm run dev
```

## Complete .env File Example

```env
# Database Configuration
MONGODB_URI=your_mongodb_connection_string

# JWT Configuration
ACCESS_TOKEN_SECRET=your_access_token_secret_here
REFRESH_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration - Add ALL frontend URLs that will access the API
ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200,http://192.168.29.20:4200
```

## How It Works

1. **Without ALLOWED_ORIGINS**: The server uses regex patterns to allow common network IPs (192.168.x.x, 10.x.x.x)
2. **With ALLOWED_ORIGINS**: The server uses your exact list, which is more reliable

## Multiple Frontend URLs

If you have multiple frontends or need to access from different IPs:

```env
ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200,http://192.168.29.20:4200,http://192.168.29.21:4200
```

**Format:** Separate multiple URLs with commas, no spaces around commas.

## Verification

After setting up:
1. Check server logs - should not show CORS errors
2. Check browser console - should not show CORS errors
3. API requests should work from both localhost and network IP

## Troubleshooting

### Still getting CORS errors?

1. **Verify the URL format:**
   - ✅ Correct: `http://192.168.29.20:4200`
   - ❌ Wrong: `192.168.29.20:4200` (missing http://)
   - ❌ Wrong: `http://192.168.29.20` (missing port)

2. **Check .env file location:**
   - Should be in `back-end/.env` (same directory as `package.json`)

3. **Restart server:**
   - Environment variables are loaded at startup
   - Changes require server restart

4. **Check browser console:**
   - Look at the "Origin" header in the error
   - Make sure it matches exactly what's in ALLOWED_ORIGINS

