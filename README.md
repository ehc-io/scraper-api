# Puppeteer REST Browser API
==================================================================

This project is a web scraping service built with Node.js, Express, and Puppeteer. It provides an API endpoint for navigating to URLs, performing clicks, and capturing screenshots and HTML content.

Features[](https://llmplayer.io/#features)
------------------------------------------

-   Navigate to specified URLs
-   Perform clicks based on pixel coordinates or CSS selectors
-   Capture screenshots
-   Save HTML content
-   Dockerized for easy deployment

Building the Container Image[](https://llmplayer.io/#building-the-container-image)
----------------------------------------------------------------------------------

To build the Docker image, run the following command in the project directory:

`docker build -t web-scraper-service .`

Running the Container[](https://llmplayer.io/#running-the-container)
--------------------------------------------------------------------

To run the container, use the following command:

`docker run -p 3000:3000 -v /path/to/downloads:/downloads web-scraper-service`

Replace `/path/to/downloads` with the path where you want to save screenshots and HTML files on your host machine.

API Usage[](https://llmplayer.io/#api-usage)
--------------------------------------------

The service exposes a single POST endpoint at `/navigate`. Here are some examples of how to use it:

1.  Basic navigation:

`curl -X POST http://localhost:3000/navigate\
  -H "Content-Type: application/json"\
  -d '{"url": "https://example.com"}'`

1.  Click at specific coordinates:

`curl -X POST http://localhost:3000/navigate\
  -H "Content-Type: application/json"\
  -d '{"url": "https://example.com", "mode": "pixel-click", "h": 100, "w": 200}'`

1.  Click on an element using a CSS selector:

`curl -X POST http://localhost:3000/navigate\
  -H "Content-Type: application/json"\
  -d '{"url": "https://example.com", "mode": "selector-click", "selector": "#submit-button"}'`

1.  Capture a screenshot:

`curl -X POST http://localhost:3000/navigate\
  -H "Content-Type: application/json"\
  -d '{"url": "https://example.com", "screenshot": true}'`

1.  Save HTML content:

`curl -X POST http://localhost:3000/navigate\
  -H "Content-Type: application/json"\
  -d '{"url": "https://example.com", "html": true}'`

The service will return a JSON response with the paths to any captured screenshots or saved HTML files, as well as the HTML content of the page.