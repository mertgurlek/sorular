// Local development server
// Usage: node api/server.js
const path = require('path');
const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env.local') });
require('dotenv').config({ path: path.join(rootDir, '.env') });

// Clean up DATABASE_URL if in psql command format (same as scripts/config.py)
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.startsWith("psql '")) {
    dbUrl = dbUrl.slice(6, -1);
} else if (dbUrl.startsWith("psql ")) {
    dbUrl = dbUrl.slice(5);
}
dbUrl = dbUrl.replace(/^['"]|['"]$/g, '');
process.env.DATABASE_URL = dbUrl;

const app = require('./index');

// Serve static files from project root
app.use(require('express').static(rootDir));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Static files from: ${rootDir}`);
});
