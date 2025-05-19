const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
fs.ensureDirSync(tempDir);

// Clean up old files every 5 minutes
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                const now = new Date().getTime();
                const fileAge = now - stats.mtime.getTime();
                if (fileAge > 5 * 60 * 1000) { // 5 minutes
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}, 5 * 60 * 1000);

// Documentation endpoint
router.get('/docs', (req, res) => {
    const docs = {
        name: "Download API",
        description: "API tải xuống media từ Facebook và Instagram",
        version: "1.0.0",
        endpoints: [
            {
                path: "/process",
                method: "POST",
                description: "Tải xuống media từ URL",
                requestBody: {
                    url: "URL của media cần tải",
                    type: "Loại media (image/video)"
                },
                response: {
                    filename: "Tên file đã tải xuống"
                }
            },
            {
                path: "/file/:filename",
                method: "GET",
                description: "Lấy file đã tải xuống",
                params: {
                    filename: "Tên file cần lấy"
                }
            }
        ],
        examples: {
            process: {
                request: {
                    url: "https://example.com/video.mp4",
                    type: "video"
                },
                response: {
                    filename: "550e8400-e29b-41d4-a716-446655440000.mp4"
                }
            }
        }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.json(docs);
});

// Process download endpoint
router.post('/process', async (req, res) => {
    try {
        const { url, type } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        const filename = `${uuidv4()}.${type === 'video' ? 'mp4' : 'jpg'}`;
        const filePath = path.join(tempDir, filename);

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        writer.on('finish', () => {
            res.json({ filename });
        });

        writer.on('error', (err) => {
            console.error('Error writing file:', err);
            res.status(500).json({ error: 'Error saving file' });
        });
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Error downloading file' });
    }
});

// Serve downloaded files
router.get('/file/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(tempDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
});

module.exports = router; 