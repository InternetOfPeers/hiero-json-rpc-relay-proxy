const http = require("http");
const https = require("https");
const url = require("url");

// Configuration
const PORT = 3000;
const TARGET_SERVER = "https://mainnet.hashio.io/api";

const server = http.createServer((req, res) => {
  // Parse the target URL
  const targetUrl = new URL(req.url, TARGET_SERVER);

  // Determine which module to use based on protocol
  const httpModule = targetUrl.protocol === "https:" ? https : http;

  // Prepare request options
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host, // Update host header
    },
  };

  // Create the proxy request
  const proxyReq = httpModule.request(options, (proxyRes) => {
    // Copy status code and headers from target response
    res.writeHead(proxyRes.statusCode, proxyRes.headers);

    // Pipe the response back to client
    proxyRes.pipe(res);
  });

  // Handle proxy request errors
  proxyReq.on("error", (err) => {
    console.error("Proxy request error:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Proxy Error: Unable to connect to target server");
  });

  // Handle client request errors
  req.on("error", (err) => {
    console.error("Client request error:", err.message);
    proxyReq.destroy();
  });

  // Pipe client request to proxy request
  req.pipe(proxyReq);
});

// Handle server errors
server.on("error", (err) => {
  console.error("Server error:", err.message);
});

// Start the server
server.listen(PORT, () => {
  console.log(`Redirect proxy server running on port ${PORT}`);
  console.log(`Redirecting all requests to: ${TARGET_SERVER}`);
  console.log(`Test it: curl http://localhost:${PORT}/any/path`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
