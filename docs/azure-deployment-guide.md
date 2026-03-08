# Hemora Azure Deployment Guide (Student Credits)

Complete step-by-step guide to deploy Hemora on Azure using the Portal (no CLI needed).
Frontend and backend are served from a single App Service (no Static Web Apps needed).

## Prerequisites
- Azure for Students account (portal.azure.com)
- GitHub fork of Hemora repo (with all branches)
- Code on `deploy` branch

---

## STEP 1: Upload ML Models to GitHub Release

Your model files (~230MB) are git-ignored, so we host them as a GitHub Release.

1. Go to your fork's releases page: `https://github.com/YOUR_USERNAME/Hemora/releases/new`
2. Click **"Choose a tag"** → type `models-v1` → click **"Create new tag"**
3. Set **Target branch** to `deploy`
4. Title: `ML Model Weights v1`
5. Drag and drop ALL these files from `backend/models/`:
   - `thalassemia/thal_yolo_best.pt`
   - `thalassemia/thal_hybrid_best.pt`
   - `thalassemia/thal_scaler.pkl`
   - `all_leukemia/all_cnn_best.keras`
   - `all_leukemia/all_yolo_best.pt`
   - `sickle_cell/scd_rcnn_local_classifier.pt`
   - `sickle_cell/scd_yolov8_local_detect.pt`
   - `ida/ida_resnet50_best.pt`
   - `ida/ida_yolo_best.pt`
6. Click **"Publish release"**

> Note: GitHub allows up to 2GB per release asset. Your total is ~230MB so this is fine.

---

## STEP 2: Create Resource Group

1. Go to https://portal.azure.com
2. Search **"Resource groups"** in the top search bar
3. Click **"+ Create"**
   - Subscription: **Azure for Students**
   - Resource group name: `hemora-rg`
   - Region: **Central India**
4. Click **"Review + Create"** → **"Create"**

---

## STEP 3: Create PostgreSQL Database

1. Search **"Azure Database for PostgreSQL"** in the portal
2. Click **"+ Create"** → Choose **"Flexible Server"**
3. Fill in:
   - Resource group: `hemora-rg`
   - Server name: `hemora-backend-server` (or your unique name)
   - Region: **Central India**
   - PostgreSQL version: **17**
   - Workload type: **Dev/Test** (cheapest)
   - Compute + Storage: Click **"Configure server"**
     - Compute tier: **Burstable**
     - Compute size: **Standard_B1ms** (1 vCore, 2GB RAM)
     - Storage size: **32 GiB**
   - Authentication method: **PostgreSQL authentication only**
   - Admin username: `hemora_admin`
   - Password: (choose a strong password, SAVE IT)
4. **Networking tab**:
   - Select **"Allow public access"**
   - Check **"Allow access to Azure services"**
5. Click **"Review + Create"** → **"Create"**
6. Wait for deployment (~5-10 minutes)

### After PostgreSQL is created:
1. Go to your PostgreSQL server resource
2. Click **"Databases"** in the left menu
3. Click **"+ Add"** → Name: `hemora` → **"Save"**

---

## STEP 4: Create App Service (Backend + Frontend)

This single App Service serves both the Django API and the React frontend.

1. Search **"App Services"** in the portal
2. Click **"+ Create"** → **"Web App"**
3. Fill in:
   - Resource group: `hemora-rg`
   - Name: `hemora-backend` (becomes `hemora-backend.azurewebsites.net`)
   - Publish: **Code**
   - Runtime stack: **Python 3.11**
   - Operating System: **Linux**
   - Region: **Central India**
   - Pricing plan: Click **"Create new"**
     - Choose **B2** (3.5GB RAM) for ML models — ~$55/mo
     - OR try **B1** (1.75GB RAM) — ~$30/mo (might be tight)
4. **Deployment tab**:
   - Continuous deployment: **Enable**
   - Sign in to GitHub → Authorize
   - Organization: your GitHub username
   - Repository: `Hemora`
   - Branch: `deploy`
   - Basic authentication: **Disable**
5. **Networking tab**: Keep defaults (public access On)
6. **Monitor + secure tab**: Application Insights **No**, Defender **unchecked**
7. **Tags**: Skip
8. Click **"Review + Create"** → **"Create"**

### Configure Environment Variables:
1. Go to your App Service → **"Environment variables"** (left menu under Settings)
2. Click **"+ Add"** for EACH variable:

| Name | Value |
|------|-------|
| `SECRET_KEY` | (use a random 50+ character string) |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `hemora-backend.azurewebsites.net` |
| `DB_NAME` | `hemora` |
| `DB_USER` | `hemora_admin` |
| `DB_PASSWORD` | (your PostgreSQL password from Step 3) |
| `DB_HOST` | `hemora-backend-server.postgres.database.azure.com` |
| `DB_PORT` | `5432` |
| `CORS_ALLOWED_ORIGINS` | `https://hemora-backend.azurewebsites.net` |
| `SECURE_SSL_REDIRECT` | `False` |

3. Leave **"Deployment slot setting"** unchecked for all
4. Click **"Apply"** at the top

### Set Startup Command:
1. Go to **"Configuration (preview)"** → **"Stack settings"** tab
2. In **"Startup Command"** field, enter:
   ```
   cd /home/site/wwwroot/backend && bash startup.sh
   ```
3. Click **"Apply"**

---

## STEP 5: Commit and Push Code

Push all deployment config changes to your fork's `deploy` branch.
This triggers GitHub Actions to deploy automatically.

The startup script will:
1. Install Python dependencies
2. Install Tesseract OCR
3. Download ML models from GitHub Release
4. Build the React frontend (installs Node.js, runs `npm install` + `npm run build`)
5. Run database migrations
6. Start Gunicorn server

---

## STEP 6: Verify Deployment

### Check the site:
1. Visit: `https://hemora-backend.azurewebsites.net`
2. You should see the Hemora login page (React frontend)
3. API is at: `https://hemora-backend.azurewebsites.net/api/`

> Note: First deployment takes ~10-15 minutes (installs Node.js, builds frontend, downloads models).

### Check Logs (if something is wrong):
1. App Service → **"Log stream"** (left menu under Monitoring) — shows live logs
2. App Service → **"SSH"** (left menu under Development Tools) — terminal access

---

## STEP 7: Download ML Models (If Auto-Download Fails)

The startup script auto-downloads models from the GitHub Release. If that fails:

1. App Service → **"SSH"** (left menu under Development Tools)
2. In the terminal, run:
   ```bash
   cd /home/site/wwwroot/backend
   bash download_models.sh
   ```
3. Verify: `ls -la models/thalassemia/`
4. Restart the App Service from the **Overview** page

---

## Architecture

Everything runs on a single App Service:

```
https://hemora-backend.azurewebsites.net
├── /              → React frontend (login, dashboard, results)
├── /api/          → Django REST API (auth, patients, diagnosis)
├── /admin/        → Django admin panel
└── /media/        → Uploaded files (blood smear images, CBC reports)
```

- Frontend is built during startup (`npm run build` → `frontend_build/`)
- Django serves the React build files via a catch-all URL pattern
- API and frontend share the same domain — no CORS issues

---

## Estimated Monthly Cost

| Service | Cost |
|---------|------|
| App Service B2 (3.5GB RAM) | ~$55 |
| PostgreSQL B1ms | ~$15 |
| **Total** | **~$70/mo** |

Your $100 student credit covers ~1.4 months. To save money:
- Use B1 App Service ($30/mo) → total ~$45/mo → ~2.2 months

---

## Troubleshooting

### "Application Error" on the site
- Check **Log stream** for errors
- Most common: missing environment variable or DB connection issue
- SSH in and check if `startup.sh` completed successfully

### Frontend shows blank page
- SSH in and check: `ls /home/site/wwwroot/backend/frontend_build/`
- If empty, the frontend build failed. Check logs for npm errors
- Try manually: `cd /home/site/wwwroot/frontend && npm install && npm run build`

### Models not loading
- SSH into App Service and check `ls models/`
- Run `bash download_models.sh` manually
- Check if GitHub Release assets are publicly accessible

### Database connection refused
- Ensure "Allow access to Azure services" is enabled on PostgreSQL
- Verify DB_HOST, DB_USER, DB_PASSWORD in Environment Variables
- DB_HOST should match your actual PostgreSQL server name

### OCR (Tesseract) not working
- The startup script installs it automatically
- If not, SSH in and run: `apt-get update && apt-get install -y tesseract-ocr`

---

## Redeployment

After you push new code to the `deploy` branch:
- GitHub Actions auto-deploys to App Service
- To rebuild the frontend, SSH in and delete `frontend_build/` folder, then restart
- No manual steps needed for backend changes!
