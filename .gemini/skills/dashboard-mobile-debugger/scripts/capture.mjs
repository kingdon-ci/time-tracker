import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://127.0.0.1:3000';
const outputPath = process.argv[3] || 'screenshot.png';
const width = parseInt(process.argv[4]) || 375;
const height = parseInt(process.argv[5]) || 812;

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.screenshot({ path: outputPath });
    await browser.close();
    console.log(`Screenshot saved to ${outputPath}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
