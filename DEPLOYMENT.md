# 🚀 Relay Deployment Guide

This guide covers deploying Relay to production using free tier services.

## 📋 Prerequisites

- Git repository access
- Three free tier hosting services (see recommendations below)
- PostgreSQL database (free tier)
- Domain names (optional but recommended)

## 🏗️ Architecture Overview

```
Frontend (React) → Backend (Flask) → Database (PostgreSQL)
     ↓                    ↓              ↓
  Vercel/Netlify    Railway/Render    Supabase/Neon
```

## 🔧 Backend Deployment

### 1. **Railway** (Recommended - Free tier available)
- **Service**: Railway.app
- **Free tier**: $5 credit monthly
- **Setup**:
  1. Connect your GitHub repo
  2. Select the `server/` directory
  3. Set environment variables (see `.env.example`)
  4. Deploy

### 2. **Render** (Alternative)
- **Service**: Render.com
- **Free tier**: 750 hours/month
- **Setup**:
  1. Connect GitHub repo
  2. Select "Web Service"
  3. Point to `server/` directory
  4. Set environment variables

### 3. **Required Environment Variables**
```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database_name

# Flask
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=your-secret-key-here
PORT=5000

# CORS
CORS_ORIGINS=https://your-frontend-domain.com,http://localhost:3000

# Email
RELAY_EMAIL=your-email@gmail.com
RELAY_EMAIL_PASSWORD=your-app-password

# Upload
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=16777216
```

## 🗄️ Database Deployment

### 1. **Supabase** (Recommended)
- **Service**: Supabase.com
- **Free tier**: 500MB database, 2GB bandwidth
- **Setup**:
  1. Create new project
  2. Get connection string
  3. Run migrations (see below)

### 2. **Neon** (Alternative)
- **Service**: Neon.tech
- **Free tier**: 3GB storage, shared compute
- **Setup**: Similar to Supabase

### 3. **Database Migration**
```bash
# Update DATABASE_URL in your backend environment
# The backend will automatically create tables on first run
# Or run migrations manually if needed
```

## 🌐 Frontend Deployment

### 1. **Vercel** (Recommended)
- **Service**: Vercel.com
- **Free tier**: Unlimited deployments
- **Setup**:
  1. Connect GitHub repo
  2. Point to `client/` directory
  3. Set environment variables
  4. Deploy

### 2. **Netlify** (Alternative)
- **Service**: Netlify.com
- **Free tier**: 100GB bandwidth/month
- **Setup**: Similar to Vercel

### 3. **Required Environment Variables**
```bash
# API Configuration
REACT_APP_API_URL=https://your-backend-domain.com
REACT_APP_API_PORT=5000

# Environment
REACT_APP_ENV=production
```

## 📁 File Storage

### **For Production**
- **Railway/Render**: Use their persistent storage
- **Alternative**: AWS S3 (free tier: 5GB)
- **Local**: Not recommended for production

### **Update Upload Paths**
The backend automatically handles file paths. For production:
- Files are stored in the configured `UPLOAD_FOLDER`
- URLs are generated based on the backend domain
- Thumbnails are created automatically

## 🚀 Deployment Steps

### **Step 1: Prepare Backend**
1. Update `server/env.example` with your values
2. Create `.env` file in `server/` directory
3. Test locally with new environment variables

### **Step 2: Deploy Backend**
1. Push to GitHub
2. Deploy to Railway/Render
3. Set environment variables
4. Test API endpoints

### **Step 3: Deploy Database**
1. Create Supabase/Neon project
2. Update `DATABASE_URL` in backend
3. Test database connection

### **Step 4: Deploy Frontend**
1. Update `client/env.example` with backend URL
2. Create `.env` file in `client/` directory
3. Deploy to Vercel/Netlify
4. Test frontend functionality

### **Step 5: Test Integration**
1. Test login/authentication
2. Test file uploads
3. Test all major features
4. Monitor error logs

## 🔍 Troubleshooting

### **Common Issues**
1. **CORS errors**: Check `CORS_ORIGINS` environment variable
2. **Database connection**: Verify `DATABASE_URL` format
3. **File uploads**: Check `UPLOAD_FOLDER` permissions
4. **Environment variables**: Ensure all required vars are set

### **Debug Mode**
- Set `FLASK_DEBUG=True` temporarily for debugging
- Check application logs in your hosting service
- Use browser developer tools for frontend issues

## 📊 Monitoring

### **Backend Health**
- Monitor application logs
- Check database connection status
- Monitor file upload success rates

### **Frontend Performance**
- Use Vercel/Netlify analytics
- Monitor API response times
- Check for JavaScript errors

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Database**: Use strong passwords, enable SSL
3. **CORS**: Restrict to your frontend domains only
4. **File Uploads**: Validate file types and sizes
5. **Authentication**: Ensure secure session handling

## 💰 Cost Optimization

### **Free Tier Limits**
- **Railway**: $5/month credit
- **Supabase**: 500MB database
- **Vercel**: Unlimited deployments
- **Total**: ~$5/month for full production app

### **Scaling Up**
- Upgrade individual services as needed
- Monitor usage to stay within free tiers
- Consider paid plans for production workloads

## 📞 Support

- **Railway**: Discord community
- **Supabase**: GitHub issues
- **Vercel**: Documentation and community
- **Project**: Create GitHub issues for bugs

---

**Happy Deploying! 🎉**
