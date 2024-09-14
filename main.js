const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

const app = express();
app.use(express.json());
puppeteer.use(StealthPlugin());

// const PORT = 8502;
const PORT = 3000;

// const downloadsFolder = "/mnt/genai/scraper_downloads/";
const downloadsFolder = "/downloads"

function html2Markdown(html) {
    const $ = cheerio.load(html);

    // Remove unnecessary elements
    $('script, style, header, footer, nav').remove();

    const body = $('body').length ? $('body') : $.root();

    function convertElement(element) {
        if (element.type === 'text') {
            return element.data;
        }
        const tagName = element.tagName;
        const $element = $(element);

        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            return `${'#'.repeat(parseInt(tagName[1]))} ${$element.text().trim()}\n\n`;
        }
        if (tagName === 'p') {
            return `${$element.text().trim()}\n\n`;
        }
        if (tagName === 'a') {
            return `[${$element.text()}](${$element.attr('href') || ''})`;
        }
        if (tagName === 'img') {
            return `![${$element.attr('alt') || ''}](${$element.attr('src') || ''})`;
        }
        if (['ul', 'ol'].includes(tagName)) {
            const items = [];
            $element.children('li').each((i, li) => {
                const prefix = tagName === 'ul' ? '- ' : `${i + 1}. `;
                items.push(`${prefix}${convertElement(li).trim()}`);
            });
            return items.join('\n') + '\n\n';
        }
        if (['strong', 'b'].includes(tagName)) {
            return `**${$element.text()}**`;
        }
        if (['em', 'i'].includes(tagName)) {
            return `*${$element.text()}*`;
        }
        if (tagName === 'code') {
            return `\`${$element.text()}\``;
        }
        if (tagName === 'pre') {
            return `\`\`\`\n${$element.text()}\n\`\`\`\n\n`;
        }
        return $element.contents().map((i, child) => convertElement(child)).get().join('');
    }

    let markdown = convertElement(body[0]);
    // Clean up extra newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    return markdown.trim();
}

function logMessage(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${Date.now()}.${timestamp}] ${message}`);
}

function getDataSize(data) {
  const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
  return (size / 1024).toFixed(2) + 'KB';
}

async function ensureDirectoryExists(directory) {
  try {
    await fs.access(directory);
  } catch {
    await fs.mkdir(directory);
    logMessage(`Directory '${directory}' created.`);
  }
}

async function loadSessionData(page, sessionStateFolder) {
  const cookiesString = await fs.readFile(path.join(sessionStateFolder, "cookies.json"));
  const cookies = JSON.parse(cookiesString);

  const localStorageString = await fs.readFile(path.join(sessionStateFolder, "localStorage.json"));
  const localStorage = JSON.parse(localStorageString);

  logMessage("loading session data...");
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
    const { url, mode, screenshot, save_html, selector, sessionStateFolder, pageLoadTimeout = 3000, outputMode = 'raw-html', structuredOutput = false } = req.body;
    if (!url) {
      logMessage('error: URL is required');
      return res.status(400).json({ error: 'URL is required' });
    }
    if (!['pixel-click', 'selector-click', 'selector-load', 'full-body-load'].includes(mode)) {
      logMessage('error: Invalid mode');
      return res.status(400).json({ error: 'Invalid mode' });
    }

    if (!['raw-html', 'markdown'].includes(outputMode)) {
      logMessage('error: Invalid output mode');
      return res.status(400).json({ error: 'Invalid output mode' });
    }

    logMessage('launching browser...');
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    logMessage('browser launched');

    const page = await browser.newPage();
    logMessage('new page created');

    await page.setViewport({ width: 1600, height: 900 });

    if (sessionStateFolder) {
      await loadSessionData(page, sessionStateFolder);
    }

    logMessage(`navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: pageLoadTimeout });

    let htmlContent = '';
    if (mode === 'pixel-click') {
      logMessage(`clicking at coordinates...`);
      await page.mouse.click(0, 0); // default coordinates
      logMessage('click performed');
      logMessage('waiting for navigation after click...');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: pageLoadTimeout });
      logMessage('navigation after click completed');
    } else if (mode === 'selector-click') {
      logMessage(`clicking on element with selector ${selector}...`);
      await page.click(selector);
      logMessage('click performed');
      logMessage('waiting for navigation after click...');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: pageLoadTimeout });
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

    let responseContent = htmlContent;
    if (outputMode === 'markdown') {
      logMessage('converting HTML to Markdown...');
      responseContent = html2Markdown(htmlContent);
    }

    let title = '';
    if (structuredOutput) {
      logMessage('retrieving page title...');
      title = await page.title();
    }

    await browser.close();
    logMessage('browser closed');

    let responseData;
    if (structuredOutput) {
      responseData = {
        url: url,
        title: title,
        body: responseContent,
      };
      logMessage(`structured response sent (${getDataSize(responseData)})`);
      res.json(responseData);
    } else {
      responseData = responseContent;
      logMessage(`${outputMode} response sent (${getDataSize(responseData)})`);
      res.set("Content-Type", outputMode === 'raw-html' ? "text/html" : "text/markdown");
      res.send(responseData);
    }
  } catch (error) {
    logMessage('Error occurred: ' + error.message);
    res.status(500).json({ error: 'An error occurred', details: error.message });
  }
});

app.use((req, res) => {
  logMessage('invalid endpoint accessed');
  res.status(500).json({ error: 'Invalid endpoint' });
});

app.listen(PORT, () => {
  logMessage(`server is running on port ${PORT}`);
});