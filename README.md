<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6f23f979-e744-4437-ad6c-f2d31cb17432

## GitHub Pages frontend

This repository now deploys its Vite frontend to GitHub Pages from the `main`
branch. Once the GitHub Pages workflow completes, the site is served from:

`https://zainkhan1994.github.io/Cloud-Optimized-Real-Time-Assistant-Navigation-Agent/`

Because GitHub Pages is a static host, the deployed frontend asks for a Gemini
API key at runtime and stores it in the browser's local storage. That keeps the
site usable without embedding secrets in the repository or workflow.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
