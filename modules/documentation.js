const fs = require('fs-extra');
const path = require('path');

module.exports = (router) => {
    // Get all API documentation
    router.get('/all', async (req, res) => {
        try {
            const modulesDir = path.join(__dirname);
            const modules = await fs.readdir(modulesDir);
            const docs = {};

            for (const file of modules) {
                if (file.endsWith('.js') && file !== 'documentation.js') {
                    const moduleName = path.basename(file, '.js');
                    try {
                        const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/${moduleName}/docs`);
                        const data = await response.json();
                        docs[moduleName] = data;
                    } catch (error) {
                        console.error(`Error loading docs for ${moduleName}:`, error);
                    }
                }
            }

            res.json({
                version: '1.0.0',
                modules: docs
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get specific module documentation
    router.get('/module/:name', async (req, res) => {
        try {
            const moduleName = req.params.name;
            const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/${moduleName}/docs`);
            const data = await response.json();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Health check
    router.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'documentation-api' });
    });
}; 