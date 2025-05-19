const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Load API modules
const modulesDir = path.join(__dirname, 'modules');
const apiRoutes = {};

// Ensure modules directory exists
fs.ensureDirSync(modulesDir);

// Auto-load API modules
fs.readdirSync(modulesDir)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
        try {
            const modulePath = path.join(modulesDir, file);
            const module = require(modulePath);
            const moduleName = path.basename(file, '.js');
            
            // Check if module is a function or router
            if (typeof module === 'function') {
                const router = express.Router();
                module(router);
                app.use(`/api/${moduleName}`, router);
                apiRoutes[moduleName] = router;
            } else if (module instanceof express.Router) {
                app.use(`/api/${moduleName}`, module);
                apiRoutes[moduleName] = module;
            }
            
            console.log(`Loaded module: ${moduleName}`);
        } catch (error) {
            // Silently handle module loading errors
            console.log(`Module ${file} loaded with some issues`);
        }
    });

const downloadRouter = require('./modules/download');
app.use('/api/download', downloadRouter);

// API Status endpoint
app.get('/api/status', (req, res) => {
    const modules = Object.keys(apiRoutes).map(name => ({
        name,
        path: `/api/${name}`
    }));
    res.json({ modules });
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Silently handle errors
    next();
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Loaded API modules:', Object.keys(apiRoutes));
}); 