# WebSocket Deployment Checklist

Use this checklist to ensure a smooth deployment of your WebSocket-enabled Relay app.

## Pre-Deployment Testing

- [ ] Backend server starts without errors locally
- [ ] Frontend app starts without errors locally
- [ ] Browser console shows "✅ WebSocket connected successfully"
- [ ] Creating an event in one window shows in another window instantly
- [ ] Creating a shot request triggers real-time notification
- [ ] No JavaScript errors in browser console
- [ ] Backend logs show "📡 Broadcasted event..." messages

## Backend Deployment (Railway)

- [ ] Push code to GitHub (with updated requirements.txt)
- [ ] Railway automatically deploys new version
- [ ] Check Railway deployment logs for:
  - [ ] "🔌 WebSocket support enabled"
  - [ ] No import errors
  - [ ] Server starts successfully
- [ ] Set environment variables in Railway:
  - [ ] `CORS_ORIGINS` includes your Vercel URL (e.g., `https://your-app.vercel.app`)
  - [ ] `DATABASE_URL` is set
  - [ ] `SENDGRID_API_KEY` is set (if using email)
  - [ ] `SENDGRID_FROM_EMAIL` is set (if using email)

## Frontend Deployment (Vercel)

- [ ] Push code to GitHub (with updated package.json)
- [ ] Vercel automatically deploys new version
- [ ] Set environment variables in Vercel:
  - [ ] `REACT_APP_API_URL` = Your Railway backend URL (e.g., `https://your-service.up.railway.app`)
- [ ] Verify build succeeds

## Post-Deployment Testing

- [ ] Visit production frontend URL
- [ ] Open browser console and verify:
  - [ ] WebSocket connects to production backend
  - [ ] No CORS errors
  - [ ] "✅ WebSocket connected successfully" appears
- [ ] Test real-time updates:
  - [ ] Open two browser tabs/windows
  - [ ] Create an event in tab 1
  - [ ] Verify it appears in tab 2 without refresh
- [ ] Test on mobile device
- [ ] Test with multiple users simultaneously

## Rollback Plan (If Needed)

If something goes wrong, you can easily rollback:

### Option 1: Quick Disable
The app will still work without WebSockets! Users just need to refresh manually.

### Option 2: Full Rollback
- [ ] Revert to previous Git commit
- [ ] Redeploy to Railway and Vercel
- [ ] Remove WebSocket dependencies if needed

## Monitoring

After deployment, monitor for:

- [ ] WebSocket connection errors in browser console
- [ ] Backend errors in Railway logs
- [ ] User reports of "not seeing updates"
- [ ] Performance issues (should be minimal)

## Common Issues & Solutions

### Issue: CORS Error
**Solution:** Add Vercel URL to `CORS_ORIGINS` in Railway

### Issue: WebSocket Won't Connect
**Solution:** 
1. Check Railway backend URL is correct in Vercel env vars
2. Ensure Railway backend is running (check logs)
3. Verify HTTPS is used in production

### Issue: Updates Not Broadcasting
**Solution:** 
1. Check Railway logs for "📡 Broadcasted..." messages
2. Verify broadcast functions are being called
3. Check browser console for received events

### Issue: Connection Keeps Dropping
**Solution:** 
1. Check Railway instance isn't sleeping/restarting
2. Verify network connectivity
3. Check keep-alive pings are working (every 30 seconds)

## Success Criteria

Your deployment is successful when:

✅ No errors in Railway logs
✅ No errors in browser console
✅ WebSocket shows as connected in browser
✅ Real-time updates work across multiple browser windows
✅ Notifications appear instantly
✅ App works even if WebSocket fails (graceful degradation)

---

**Pro Tip:** Test with a colleague or friend to verify real-time updates work between different users!

