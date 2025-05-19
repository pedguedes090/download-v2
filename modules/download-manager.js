const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
fs.ensureDirSync(tempDir);

module.exports = (router) => {
    // Documentation endpoint
    router.get('/docs', (req, res) => {
        const docs = {
            name: "Download Manager Core",
            description: "Core functionality for managing file downloads and cleanup",
            version: "1.0.0",
            endpoints: [
                {
                    path: "/download",
                    method: "POST",
                    description: "Tải xuống file từ URL",
                    requestBody: {
                        url: "URL của file cần tải",
                        type: "Loại file (image/video)"
                    },
                    response: {
                        filename: "Tên file đã tải xuống",
                        path: "Đường dẫn đến file"
                    }
                },
                {
                    path: "/cleanup",
                    method: "POST",
                    description: "Xóa file cũ",
                    requestBody: {
                        age: "Thời gian (phút) để xóa file cũ hơn"
                    },
                    response: {
                        message: "Thông báo kết quả cleanup"
                    }
                }
            ],
            examples: {
                download: {
                    request: {
                        url: "https://example.com/video.mp4",
                        type: "video"
                    },
                    response: {
                        filename: "550e8400-e29b-41d4-a716-446655440000.mp4",
                        path: "/path/to/temp/550e8400-e29b-41d4-a716-446655440000.mp4"
                    }
                },
                cleanup: {
                    request: {
                        age: 5
                    },
                    response: {
                        message: "Cleaned up 3 files older than 5 minutes"
                    }
                }
            }
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.json(docs);
    });

    // Download file
    router.post('/download', async (req, res) => {
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
                res.json({ 
                    filename,
                    path: filePath
                });
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

    // Cleanup old files
    router.post('/cleanup', async (req, res) => {
        try {
            const { age = 5 } = req.body; // Default 5 minutes
            const files = await fs.readdir(tempDir);
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                const fileAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60); // Age in minutes

                if (fileAge > age) {
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }

            res.json({ 
                message: `Cleaned up ${deletedCount} files older than ${age} minutes`
            });
        } catch (error) {
            console.error('Cleanup error:', error);
            res.status(500).json({ error: 'Error cleaning up files' });
        }
    });
}; 