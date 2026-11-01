import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:90000,workers:1,use:{baseURL:'http://127.0.0.1:4178/bibproof/',browserName:'chromium',headless:true},webServer:{command:'npm run dev -- --port 4178',url:'http://127.0.0.1:4178/bibproof/',reuseExistingServer:!process.env.CI}});
