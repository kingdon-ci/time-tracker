import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const ACCOUNTS = [
  { name: 'Account A', id: 'kingdon@tuesdaystudios.com' }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function scrapeGroq() {
  const results = {
    accounts: [],
    todayTotal: 0,
    thisMonthTotal: 0,
    lastMonthTotal: 0,
    generated_at: new Date().toISOString()
  };

  for (const account of ACCOUNTS) {
    console.log(`\n--- Processing ${account.name} (${account.id}) ---`);
    
    // Use a persistent context directory so cookies and LocalStorage are saved across runs
    const userDataDir = path.join(process.cwd(), `.groq-session-${account.id.replace(/[@.]/g, '_')}`);
    
    let context;
    try {
      context = await chromium.launchPersistentContext(userDataDir, { headless: false });
    } catch (error) {
      if (error.message.includes('npx playwright install')) {
        console.error('\n[ERROR] Playwright browsers are not installed.');
        console.error('Please run: npx playwright install chromium\n');
      } else {
        console.error('\n[ERROR] Failed to launch browser:', error.message);
      }
      process.exit(1);
    }
    
    // Playwright persistent contexts automatically have a default page
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    await page.goto('https://console.groq.com/dashboard/usage');

    console.log(`Action Required: Please ensure you are logged into ${account.id}.`);
    console.log(`Note: Since we are using a persistent session, you might already be logged in.`);
    console.log(`If you are not logged in, please use the one-time email link (or your preferred method) to log in.`);
    
    await question('Press [Enter] here ONLY AFTER you are logged in and can see the "Usage" data for this account...');

    // Attempt to auto-detect data, but allow retry if extraction returns 0
    let usageData = { today: 0, thisMonth: 0 };
    let lastMonthData = { today: 0, thisMonth: 0 };
    let confirmed = false;

    while (!confirmed) {
      usageData = await extractUsage(page);
      console.log(`\nDetected current data for ${account.name}: Today=$${usageData.today.toFixed(2)}, ThisMonth=$${usageData.thisMonth.toFixed(2)}`);
      
      const lastMonthUrl = getLastMonthUrl();
      console.log(`Navigating to last month's usage...`);
      await page.goto(lastMonthUrl);
      await page.waitForTimeout(3000);
      lastMonthData = await extractUsage(page);
      console.log(`Detected last month data for ${account.name}: $${lastMonthData.thisMonth.toFixed(2)}`);

      const ans = await question('\nDoes this look correct? (y=yes / r=retry / m=manual entry): ');
      if (ans.toLowerCase() === 'y' || ans === '') {
        confirmed = true;
      } else if (ans.toLowerCase() === 'm') {
        const t = await question('Enter Today cost ($): ');
        const tm = await question('Enter This Month cost ($): ');
        const lm = await question('Enter Last Month cost ($): ');
        
        usageData.today = parseFloat(t) || 0;
        usageData.thisMonth = parseFloat(tm) || 0;
        lastMonthData.thisMonth = parseFloat(lm) || 0;
        confirmed = true;
      } else {
        console.log('Returning to current month usage for retry...');
        await page.goto('https://console.groq.com/dashboard/usage');
        await question('Wait for the page to load, then press [Enter] to try extracting again...');
      }
    }

    results.accounts.push({
      name: account.name,
      id: account.id,
      today: usageData.today,
      thisMonth: usageData.thisMonth,
      lastMonth: lastMonthData.thisMonth
    });

    results.todayTotal += usageData.today;
    results.thisMonthTotal += usageData.thisMonth;
    results.lastMonthTotal += lastMonthData.thisMonth;

    console.log(`Scraped ${account.name}: Today=$${usageData.today.toFixed(2)}, ThisMonth=$${usageData.thisMonth.toFixed(2)}, LastMonth=$${lastMonthData.thisMonth.toFixed(2)}`);

    // Close the context, which flushes state to disk. We DO NOT clear cookies.
    await context.close();
  }

  rl.close();

  const outputPath = path.join(process.cwd(), 'web/public/groq_summary.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outputPath}`);
}

async function extractUsage(page) {
  // Give it a moment to ensure charts/values are rendered
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const findCostByLabel = (label) => {
      // Look for a label, then look for a sibling or parent child that has a dollar sign
      const elements = Array.from(document.querySelectorAll('div, span, p, h1, h2, h3, h4'));
      const labelEl = elements.find(el => el.textContent && el.textContent.trim().toLowerCase() === label.toLowerCase());
      
      if (!labelEl) {
        // Try partial match if exact match fails
        const partialLabelEl = elements.find(el => el.textContent && el.textContent.toLowerCase().includes(label.toLowerCase()) && el.children.length === 0);
        if (!partialLabelEl) return 0;
        return searchNearbyForCost(partialLabelEl);
      }
      
      return searchNearbyForCost(labelEl);
    };

    const searchNearbyForCost = (el) => {
      // Search siblings, then parent's children
      const textSearch = (node) => {
        if (!node || !node.textContent) return null;
        // Match optional <, spaces, $, spaces, number (e.g. "< $0.01" or "$0.03")
        const match = node.textContent.match(/<?\s*\$\s?(\d+\.\d+)/);
        return match ? parseFloat(match[1]) : null;
      };

      // Check current element
      let val = textSearch(el);
      if (val !== null) return val;

      // Check parent
      if (el.parentElement) {
        val = textSearch(el.parentElement);
        if (val !== null) return val;
        
        // Check grandparent as a fallback for nested structures
        if (el.parentElement.parentElement) {
          val = textSearch(el.parentElement.parentElement);
          if (val !== null) return val;
        }
      }
      return 0;
    };

    // Groq usage page labels
    return {
      today: findCostByLabel('Today') || 0,
      thisMonth: findCostByLabel('Cumulative Cost') || findCostByLabel('Total Cost') || 0
    };
  });

  return data;
}

function getLastMonthUrl() {
  const now = new Date();
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const from = firstDayLastMonth.toISOString().split('T')[0];
  const to = lastDayLastMonth.toISOString().split('T')[0];
  
  return `https://console.groq.com/dashboard/usage?dateRange={"from":"${from}","to":"${to}"}`;
}

scrapeGroq().catch(console.error);