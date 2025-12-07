# Vercel Deployment Guide

This document explains how automatic deployment to Vercel is configured for this project.

## Overview

The project uses GitHub Actions to automatically deploy to Vercel on every push to the configured branches. This ensures that:
- The first push will create an initial deployment
- Subsequent pushes will update the existing deployment
- All deployments are production deployments

## Configuration

### GitHub Actions Workflow

The workflow is defined in `.github/workflows/vercel-deploy.yml` and is triggered on push events to:
- `main` branch
- `master` branch  
- `copilot/automate-vercel-deployment` branch (for testing)

### Required Secrets

To enable deployment, configure these secrets in your GitHub repository:

| Secret Name | Description | How to Get It |
|-------------|-------------|---------------|
| `VERCEL_TOKEN` | Authentication token for Vercel API | Generate at https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Your Vercel organization/team ID | Found in `.vercel/project.json` after running `vercel link` |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Found in `.vercel/project.json` after running `vercel link` |

### Step-by-Step Setup

#### 1. Create a Vercel Project

First time setup:
```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Link your project (run in project root)
vercel link
```

Follow the prompts:
- Set up and deploy? → Yes
- Which scope? → Select your account/team
- Link to existing project? → No (for new project) or Yes (if project exists)
- What's your project's name? → oinkonomics (or your preferred name)
- In which directory is your code located? → ./

This creates a `.vercel` directory with your project configuration.

#### 2. Get Your Project IDs

After running `vercel link`, view your configuration:
```bash
cat .vercel/project.json
```

You'll see something like:
```json
{
  "orgId": "team_xxxxxxxxxxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxxxxxxxxxx"
}
```

#### 3. Get Your Vercel Token

1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a name (e.g., "GitHub Actions")
4. Set expiration (recommended: 1 year)
5. Click "Create"
6. Copy the token immediately (you won't be able to see it again)

#### 4. Add Secrets to GitHub

1. Go to your GitHub repository
2. Click "Settings"
3. Navigate to "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Add these three secrets:
   - Name: `VERCEL_TOKEN`, Value: (your token from step 3)
   - Name: `VERCEL_ORG_ID`, Value: (the orgId from step 2)
   - Name: `VERCEL_PROJECT_ID`, Value: (the projectId from step 2)

## How It Works

1. **Trigger**: When you push code to a configured branch
2. **Checkout**: GitHub Actions checks out your code
3. **Deploy**: The Vercel Action deploys your code using:
   - Your authentication token
   - Your organization and project IDs
   - The `--prod` flag for production deployment

## Monitoring Deployments

### In GitHub
- Go to the "Actions" tab in your repository
- You'll see each workflow run with its status
- Click on a run to see detailed logs

### In Vercel
- Go to https://vercel.com/dashboard
- Select your project
- View all deployments and their status
- Access your live production URL

## Troubleshooting

### Workflow fails with "Invalid token"
- Verify your `VERCEL_TOKEN` is correct
- Token may have expired - generate a new one

### Workflow fails with "Project not found"
- Check that `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are correct
- Ensure the project exists in Vercel dashboard

### Deployment succeeds but site doesn't update
- Check Vercel dashboard for the deployment status
- Verify you're checking the production URL, not a preview URL
- May need to clear browser cache

## Production URL

After successful deployment, your site will be available at:
- `https://your-project-name.vercel.app`
- Custom domains can be configured in Vercel dashboard

## Notes

- The `.vercel` directory should NOT be committed to git (it's in `.gitignore`)
- Each push creates a new deployment
- Previous deployments are preserved in Vercel (can be accessed from dashboard)
- Production deployments are automatically live
