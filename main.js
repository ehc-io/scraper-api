const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

puppeteer.use(StealthPlugin());

function logMessage(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${Date.now()}.${timestamp}] ${message}`);
}

app.post('/navigate', async (req, res) => {
  logMessage('received request: ' + JSON.stringify(req.body));
  try {
    const { url, h, w, mode, screenshot, html, selector } = req.body;

    if (!url) {
      logMessage('error: URL is required');
      return res.status(400).json({ error: 'URL is required' });
    }

    if (mode === 'pixel-click' && (!h || !w)) {
      logMessage('error: Height and width are required for pixel-click mode');
      return res.status(400).json({ error: 'Height and width are required for pixel-click mode' });
    }

    if (mode === 'selector-click' && !selector) {
      logMessage('error: CSS selector is required for selector-click mode');
      return res.status(400).json({ error: 'CSS selector is required for selector-click mode' });
    }

    logMessage('launching browser...');
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    logMessage('browser launched');

    const page = await browser.newPage();
    logMessage('new page created');

    await page.setViewport({ width: 1600, height: 900 });

    logMessage(`navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });

    let htmlContent;
    if (mode === 'pixel-click') {
      logMessage(`clicking at coordinates (${h}), ${w}...`);
      await page.mouse.click(h, w);
      logMessage('click performed');
      logMessage('waiting for navigation after click...');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 });
      logMessage('navigation after click completed');
    } else if (mode === 'selector-click') {
      logMessage(`clicking on element with selector ${selector}...`);
      await page.click(selector);
      logMessage('click performed');
      logMessage('waiting for navigation after click...');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 });
      logMessage('navigation after click completed');
    }

    logMessage('getting page content...');
    htmlContent = await page.content();
    logMessage('page content retrieved');

    let artifactUri = null;
    if (screenshot) {
      logMessage('taking screenshot...');
      const timeStamp = Date.now();
      const imagePath = path.join('/downloads', `${timeStamp}.png`);
      await page.screenshot({ path: imagePath, fullPage: false, captureBeyondViewport: false });
      artifactUri = imagePath;
      logMessage(`screenshot saved at ${imagePath}`);
    }

    let htmlFilePath = null;
    if (html) {
      logMessage('saving HTML content...');
      const timeStamp = Date.now();
      htmlFilePath = path.join('/downloads', `${timeStamp}.html`);
      fs.writeFileSync(htmlFilePath, htmlContent);
      logMessage(`HTML content saved at ${htmlFilePath}`);
    }

    await browser.close();
    logMessage('browser closed');

    logMessage('sending response...');
    res.json({
      artifact_uri: artifactUri,
      html_file_path: htmlFilePath,
      html_body: htmlContent,
    });
    logMessage('response sent');
  } catch (error) {
    logMessage('Error occurred: ' + error.message);
    res.status(500).json({ error: 'An error occurred', details: error.message });
  }
});

app.use((req, res) => {
  logMessage('invalid endpoint accessed');
  res.status(500).json({ error: 'Invalid endpoint' });
});

const PORT = 3000;
app.listen(PORT, () => {
  logMessage(`server is running on port ${PORT}`);
});