# Network Access Configuration Guide

## Overview

This guide explains how to make your backend server accessible on the local network.

## ✅ Changes Made

### 1. **Server Binding** (`index.ts`)

- Server now listens on `0.0.0.0` (all network interfaces)
- Added automatic network IP detection
- Console now shows both local and network URLs

### 2. **CORS Configuration** (`app.ts`)

- Updated to allow network IPs in development
- Supports regex patterns for common private IP ranges:
  - `192.168.x.x:4200`
  - `10.x.x.x:4200`
- Environment variable support via `ALLOWED_ORIGINS`

### 3. **Socket.IO Configuration** (`notificationEmitter.service.ts`)

- Updated CORS to match Express CORS settings
- Allows network connections for WebSocket communication

## 🌐 How to Access from Network

### Step 1: Start the Backend Server

```bash
npm run dev
```

The server will display:

```
⚙️  Server is running!
📍 Local:   http://localhost:5000
🌐 Network: http://192.168.1.100:5000  (your actual IP)
📡 Socket.IO server initialized for real-time notifications
```

### Step 2: Find Your Network IP

The server automatically detects and displays your network IP. You can also find it manually:

**Windows:**

```cmd
ipconfig
```

Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.x.x.x)

**Linux/Mac:**

```bash
ifconfig
# or
ip addr show
```

### Step 3: Configure Frontend

Update `front-end/src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,

  // Use your network IP instead of localhost
  apiUrl: 'http://192.168.1.100:5000/api', // Replace with your network IP
  baseUrl: 'http://192.168.1.100:5000', // Replace with your network IP
  // ... rest of config
};
```

### Step 4: Access from Other Devices

1. Ensure all devices are on the same network
2. From another device, access: `http://YOUR_NETWORK_IP:5000`
3. Frontend should connect to: `http://YOUR_NETWORK_IP:4200`

## 🔧 Environment Variables

### Optional: Set Allowed Origins

Create/update `.env` file:

```env
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:4200,http://192.168.1.100:4200,http://10.0.0.100:4200
```

This allows you to specify exact origins instead of using regex patterns.

## 🔒 Security Notes

### Development Mode

- Currently allows all network IPs in development (`NODE_ENV !== 'production'`)
- This is convenient for testing but should be restricted in production

### Production Mode

- Set `NODE_ENV=production` in production
- Explicitly set `ALLOWED_ORIGINS` with exact URLs
- Consider using a reverse proxy (nginx) for better security

## 🧪 Testing Network Access

1. **Test from Same Machine:**

   ```bash
   curl http://YOUR_NETWORK_IP:5000/api/health
   ```

2. **Test from Another Device:**

   - Open browser on another device
   - Navigate to: `http://YOUR_NETWORK_IP:5000`
   - Should see API response or error (which confirms it's accessible)

3. **Test CORS:**
   - From another device, open browser console
   - Try to make a request to your API
   - Check for CORS errors

## 🚨 Troubleshooting

### Issue: Can't access from network

1. **Check Firewall:**

   - Windows: Allow port 5000 in Windows Firewall
   - Linux: `sudo ufw allow 5000`
   - Mac: System Preferences → Security → Firewall

2. **Check Router:**

   - Ensure devices are on same network/subnet
   - Some routers block device-to-device communication

3. **Verify IP Address:**
   - Ensure you're using the correct network IP (not localhost)
   - Try `ping YOUR_NETWORK_IP` from another device

### Issue: CORS errors

1. Check browser console for CORS error details
2. Verify frontend is using network IP (not localhost)
3. Check `ALLOWED_ORIGINS` environment variable
4. Ensure `NODE_ENV` is set correctly

### Issue: Socket.IO not connecting

1. Verify Socket.IO CORS configuration matches Express CORS
2. Check frontend is using network IP for Socket.IO connection
3. Check browser console for WebSocket errors

## 📝 Quick Reference

**Backend URL (from network):**

```
http://YOUR_NETWORK_IP:5000
```

**Frontend URL (from network):**

```
http://YOUR_NETWORK_IP:4200
```

**API Endpoint (from network):**

```
http://YOUR_NETWORK_IP:5000/api
```

**Socket.IO (from network):**

```
ws://YOUR_NETWORK_IP:5000
```
