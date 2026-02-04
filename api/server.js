require('dotenv').config();
const app = require('./app.js');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📁 New modular architecture loaded`);
});
