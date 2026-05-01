import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://127.0.0.1:3000';
const width = parseInt(process.argv[3]) || 375;
const height = parseInt(process.argv[4]) || 812;

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
    
    const elements = await page.evaluate((viewportWidth) => {
      return Array.from(document.querySelectorAll('*'))
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            id: el.id,
            class: el.className,
            width: rect.width,
            scrollWidth: el.scrollWidth,
            parent: el.parentElement?.tagName
          };
        })
        .filter(e => e.scrollWidth > viewportWidth || e.width > viewportWidth);
    }, width);
    
    console.log(JSON.stringify(elements, null, 2));
    await browser.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
