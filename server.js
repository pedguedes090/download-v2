const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Function to reload modules
function reloadModules() {
    console.log('Reloading modules...');
    
    // Clear require cache for all modules
    Object.keys(require.cache).forEach(key => {
        if (key.includes('modules')) {
            delete require.cache[key];
        }
    });

    // Reload all modules
    fs.readdirSync(modulesDir)
        .filter(file => file.endsWith('.js'))
        .forEach(file => {
            try {
                const modulePath = path.join(modulesDir, file);
                const module = require(modulePath);
                const moduleName = path.basename(file, '.js');
                
                // Remove old route if exists
                if (apiRoutes[moduleName]) {
                    app._router.stack = app._router.stack.filter(layer => {
                        return !layer.regexp.toString().includes(`/api/${moduleName}`);
                    });
                }

                // Add new route
                if (typeof module === 'function') {
                    const router = express.Router();
                    module(router);
                    app.use(`/api/${moduleName}`, router);
                    apiRoutes[moduleName] = router;
                } else if (module instanceof express.Router) {
                    app.use(`/api/${moduleName}`, module);
                    apiRoutes[moduleName] = module;
                }
                
                console.log(`Reloaded module: ${moduleName}`);
            } catch (error) {
                console.log(`Error reloading module ${file}:`, error.message);
            }
        });
}

// Set up auto-reload every 10 minutes
setInterval(reloadModules, 10 * 60 * 1000); // 10 minutes in milliseconds

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
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Loaded API modules:', Object.keys(apiRoutes));
    console.log('Server will restart every 10 minutes');
}); 