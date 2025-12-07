# Oinkonomics

A web application with automated deployment to Vercel.

## Automatic Deployment

This project is configured to automatically deploy to Vercel on every push to the main/master branch or the copilot/automate-vercel-deployment branch.

### Setup Instructions

To enable automatic deployment, you need to configure the following GitHub secrets in your repository:

1. **VERCEL_TOKEN**: Your Vercel authentication token
   - Get it from: https://vercel.com/account/tokens
   
2. **VERCEL_ORG_ID**: Your Vercel organization/team ID
   - Find it in your Vercel project settings under `.vercel/project.json` after running `vercel link`
   
3. **VERCEL_PROJECT_ID**: Your Vercel project ID
   - Find it in your Vercel project settings under `.vercel/project.json` after running `vercel link`

#### How to add secrets to GitHub:

1. Go to your repository on GitHub
2. Click on "Settings"
3. Navigate to "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Add each of the three secrets mentioned above

### Getting Vercel IDs

If you don't have the organization and project IDs yet:

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel login` to authenticate
3. Run `vercel link` in your project directory
4. This will create a `.vercel` directory with a `project.json` file containing your IDs
5. **Important**: Do not commit the `.vercel` directory to git (it's already in `.gitignore`)

### Deployment Process

Once the secrets are configured:
- Every push to the configured branches will trigger an automatic deployment
- The GitHub Action will build and deploy your application to Vercel
- You can monitor the deployment status in the "Actions" tab of your GitHub repository
- Vercel will provide a production URL for your deployed application