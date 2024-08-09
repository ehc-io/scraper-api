const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

puppeteer.use(StealthPlugin());

const downloadsFolder = "/downloads"
const defaultPageLoadTimeout = 3000

function logMessage(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${Date.now()}.${timestamp}] ${message}`);
}

async function ensureDirectoryExists(directory) {
  try {
    await fs.access(directory);
  } catch {
    await fs.mkdir(directory);
    console.log(`Directory '${directory}' created.`);
  }
}

async function loadSessionData(page, sessionStateFolder) {
  const cookiesString = await fs.readFile(path.join(sessionStateFolder, "cookies.json"));
  const cookies = JSON.parse(cookiesString);

  const localStorageString = await fs.readFile(path.join(sessionStateFolder, "localStorage.json"));
  const localStorage = JSON.parse(localStorageString);

  logMessage("loading session data ...");
  await page.setCookie(...cookies);

  await page.evaluateOnNewDocument((data) => {
    for (const [key, value] of Object.entries(data.localStorage)) {
      localStorage[key] = value;
    }
  }, { localStorage });
}

app.post('/navigate', async (req, res) => {
  logMessage('received request: ' + JSON.stringify(req.body));
  try {
    const { url, h, w, mode, screenshot, html, selector, sessionState_enable, sessionStateFolder, forceWaitEnabled, forceWaitInterval = 3000 } = req.body;

    if (!url) {
      logMessage('error: URL is required');
      return res.status(400).json({ error: 'URL is required' });
    }

    if (mode === 'pixel-click' && (!h || !w)) {
      logMessage('error: Height and width are required for pixel-click mode');
      return res.status(400).json({ error: 'Height and width are required for pixel-click mode' });
    }

    if ((mode === 'selector-click' || mode === 'selector-load') && !selector) {
      logMessage('error: CSS selector is required for selector-click or selector-load mode');
      return res.status(400).json({ error: 'CSS selector is required for selector-click or selector-load mode' });
    }

    if (!['pixel-click', 'selector-click', 'selector-load', 'full-body-load'].includes(mode)) {
      logMessage('error: Invalid mode');
      return res.status(400).json({ error: 'Invalid mode' });
    }

    logMessage('launching browser...');
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    logMessage('browser launched');

    const page = await browser.newPage();
    logMessage('new page created');

    await page.setViewport({ width: 1600, height: 900 });

    if (sessionState_enable) {
      if (!sessionStateFolder) {
        logMessage('error: sessionStateFolder is required when sessionState_enable is True');
        return res.status(400).json({ error: 'sessionStateFolder is required when sessionState_enable is True' });
      }
      await loadSessionData(page, sessionStateFolder);
    }

    logMessage(`navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: defaultPageLoadTimeout });

    let htmlContent = '';
    if (mode === 'pixel-click') {
      logMessage(`clicking at coordinates (${h}), ${w}...`);
      await page.mouse.click(h, w);
      logMessage('click performed');
      logMessage('waiting for navigation after click...');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: defaultPageLoadTimeout });
      logMessage('navigation after click completed');
    } else if (mode === 'selector-click') {
      logMessage(`clicking on element with selector ${selector}...`);
      await page.click(selector);
      logMessage('click performed');
      logMessage('waiting for navigation after click...');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: defaultPageLoadTimeout });
      logMessage('navigation after click completed');
    } else if (mode === 'selector-load') {
      logMessage(`loading content of element with selector ${selector}...`);
      htmlContent = await page.$eval(selector, el => el.innerHTML);
      logMessage('content of element retrieved');
    } else if (mode === 'full-body-load') {
      logMessage('getting page content...');
      htmlContent = await page.content();
      logMessage('page content retrieved');
    }

    if (forceWaitEnabled) {
      logMessage(`force waiting for ${forceWaitInterval} ms...`);
      await new Promise(resolve => setTimeout(resolve, forceWaitInterval));
      logMessage('force wait completed');
    }

    let artifactUri = null;
    if (screenshot) {
      await ensureDirectoryExists(downloadsFolder); 
      logMessage('taking screenshot...');
      const timeStamp = Date.now();
      const imagePath = path.join(downloadsFolder, `${timeStamp}.png`);
      await page.screenshot({ path: imagePath, fullPage: false, captureBeyondViewport: false });
      artifactUri = imagePath;
      logMessage(`screenshot saved at ${imagePath}`);
    }

    let htmlFilePath = null;
    if (html) {
      logMessage('saving HTML content...');
      const timeStamp = Date.now();
      htmlFilePath = path.join(downloadsFolder, `${timeStamp}.html`);
      await fs.writeFile(htmlFilePath, htmlContent);
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