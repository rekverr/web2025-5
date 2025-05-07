const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const superagent = require('superagent');

program
  .requiredOption('-h, --host <host>', 'server address')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <cache>', 'path to cache directory')
  .parse(process.argv);

const { host, port, cache } = program.opts();

fs.mkdir(cache, { recursive: true }).catch(console.error);

const getCachedImagePath = (code) => path.join(cache, `${code}.jpg`);

const fetchFromHttpCat = async (code, filePath) => {
  const url = `https://http.cat/${code}.jpg`;

  try {
    const response = await superagent.get(url).responseType('blob');
    await fs.writeFile(filePath, response.body);
    return response.body;
  } catch (err) {
    return null;
  }
};

const server = http.createServer(async (req, res) => {
  const method = req.method;
  const urlParts = req.url.split('/');
  const code = urlParts[1];

  if (!code || isNaN(code)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad request: expected path /<http-status-code>');
  }

  const filePath = getCachedImagePath(code);

  try {
    if (method === 'GET') {
      let image;

      try {
        image = await fs.readFile(filePath);
      } catch {
        image = await fetchFromHttpCat(code, filePath);
        if (!image) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Image not found');
        }
      }

      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(image);

    } else if (method === 'PUT') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        await fs.writeFile(filePath, buffer);
        res.writeHead(201, { 'Content-Type': 'text/plain' });
        res.end('Image saved');
      });
    } else {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
    }

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error');
  }
});

server.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
