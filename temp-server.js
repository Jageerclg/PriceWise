const http = require('http');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const port = 3000;

const server = http.createServer((req, res) => {
    let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    // Try to serve the file
    if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(fs.readFileSync(filePath));
    } else {
        // Fallback to index.html for SPA routing
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(publicDir, 'index.html')));
    }
});

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
