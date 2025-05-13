const http = require("http");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const { program } = require("commander");
const superagent = require("superagent");

program
  .requiredOption("-h, --host <host>", "Server host")
  .requiredOption("-p, --port <port>", "Server port")
  .requiredOption("-c, --cache <dir>", "Cache directory");

program.parse(process.argv);
const { host, port, cache } = program.opts();

if (!fs.existsSync(cache)) {
  fs.mkdirSync(cache, { recursive: true });
}

const getImagePath = (code) => path.join(cache, `${code}.jpg`);

const requestHandler = async (req, res) => {
  const method = req.method;
  const urlCode = req.url.slice(1);

  // Перевірка на формат HTTP-коду (тільки 3 цифри)
  if (!/^\d{3}$/.test(urlCode)) {
    res.writeHead(400);
    return res.end("Invalid HTTP status code");
  }

  const filePath = getImagePath(urlCode);

  switch (method) {
    case "GET":
      try {
        const data = await fsPromises.readFile(filePath);
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        return res.end(data);
      } catch {
        try {
          const catRes = await superagent.get(`https://http.cat/${urlCode}`);
          await fsPromises.writeFile(filePath, catRes.body);
          res.writeHead(200, { "Content-Type": "image/jpeg" });
          res.end(catRes.body);
        } catch {
          res.writeHead(404);
          res.end("Not Found");
        }
      }
      break;

    case "PUT":
      const buffers = [];
      req.on("data", (chunk) => buffers.push(chunk));
      req.on("end", async () => {
        try {
          const data = Buffer.concat(buffers);
          await fsPromises.writeFile(filePath, data);
          res.writeHead(201);
          res.end("Created");
        } catch {
          res.writeHead(500);
          res.end("Failed to write file");
        }
      });
      break;

    case "DELETE":
      try {
        await fsPromises.unlink(filePath);
        res.writeHead(200);
        res.end("Deleted");
      } catch {
        res.writeHead(404);
        res.end("Not Found");
      }
      break;

    default:
      res.writeHead(405);
      res.end("Method Not Allowed");
  }
};

const server = http.createServer(requestHandler);
server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
