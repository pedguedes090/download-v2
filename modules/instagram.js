const axios = require('axios');
const qs = require('qs');

module.exports = (router) => {
    // Main endpoint to get Instagram media info
    router.post('/get-media', async (req, res) => {
        try {
            const { url_media } = req.body;
            if (!url_media) {
                return res.status(400).json({ error: 'URL is required' });
            }

            const result = await instagramGetUrl(url_media);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET endpoint with URL parameter
    router.get('/get-media/:url(*)', async (req, res) => {
        try {
            const url_media = decodeURIComponent(req.params.url);
            if (!url_media) {
                return res.status(400).json({ error: 'Instagram URL is required' });
            }

            // Validate Instagram URL
            if (!url_media.includes('instagram.com')) {
                return res.status(400).json({ error: 'Invalid Instagram URL' });
            }

            const result = await instagramGetUrl(url_media);
            res.json(result);
        } catch (error) {
            console.error('Error fetching Instagram media:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to fetch Instagram media information',
                details: error.toString()
            });
        }
    });

    // GET endpoint for documentation
    router.get('/docs', (req, res) => {
        res.json({
            name: 'Instagram API',
            version: '1.0.0',
            endpoints: [
                {
                    method: 'POST',
                    path: '/api/instagram/get-media',
                    description: 'Get media information from Instagram URL',
                    body: {
                        url_media: 'Instagram post/reel URL'
                    }
                },
                {
                    method: 'GET',
                    path: '/api/instagram/get-media/:url',
                    description: 'Get media information from Instagram URL (URL encoded)',
                    params: {
                        url: 'Instagram post/reel URL (URL encoded)'
                    }
                },
                {
                    method: 'GET',
                    path: '/api/instagram/health',
                    description: 'Check API health status'
                },
                {
                    method: 'GET',
                    path: '/api/instagram/docs',
                    description: 'Get API documentation'
                }
            ],
            examples: {
                'POST /api/instagram/get-media': {
                    curl: 'curl -X POST http://localhost:3000/api/instagram/get-media -H "Content-Type: application/json" -d \'{"url_media": "https://www.instagram.com/p/your-post-id/"}\'',
                    response: {
                        results_number: 1,
                        url_list: ['https://example.com/image.jpg'],
                        post_info: {
                            owner_username: 'username',
                            owner_fullname: 'Full Name',
                            is_verified: true,
                            is_private: false,
                            likes: 1000,
                            is_ad: false,
                            caption: 'Post caption'
                        },
                        media_details: [{
                            type: 'image',
                            dimensions: {
                                height: 1080,
                                width: 1080
                            },
                            url: 'https://example.com/image.jpg'
                        }]
                    }
                },
                'GET /api/instagram/get-media/:url': {
                    curl: 'curl "http://localhost:3000/api/instagram/get-media/https%3A%2F%2Fwww.instagram.com%2Fp%2Fyour-post-id%2F"',
                    response: 'Same as POST response'
                }
            }
        });
    });

    // Health check endpoint
    router.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'instagram-api' });
    });
};

// Main function
async function instagramGetUrl(url_media, config = { retries: 5, delay: 1000 }) {
    try {
        url_media = await checkRedirect(url_media);
        const SHORTCODE = getShortcode(url_media);
        const INSTAGRAM_REQUEST = await instagramRequest(SHORTCODE, config.retries, config.delay);
        const OUTPUT_DATA = createOutputData(INSTAGRAM_REQUEST);
        return OUTPUT_DATA;
    } catch (err) {
        throw err;
    }
}

// Utilities
async function checkRedirect(url) {
    let split_url = url.split("/");
    
    if (split_url.includes("share")) {
        let res = await axios.get(url);
        return res.request.path;
    }
    return url;
}

function formatPostInfo(requestData) {
    try {
        let mediaCapt = requestData.edge_media_to_caption.edges;
        const capt = (mediaCapt.length === 0) ? "" : mediaCapt[0].node.text;
        return {
            owner_username: requestData.owner.username,
            owner_fullname: requestData.owner.full_name,
            is_verified: requestData.owner.is_verified,
            is_private: requestData.owner.is_private,
            likes: requestData.edge_media_preview_like.count,
            is_ad: requestData.is_ad,
            caption: capt
        };
    } catch (err) {
        throw new Error(`Failed to format post info: ${err.message}`);
    }
}

function formatMediaDetails(mediaData) {
    try {
        if (mediaData.is_video) {
            return {
                type: "video",
                dimensions: mediaData.dimensions,
                video_view_count: mediaData.video_view_count,
                url: mediaData.video_url,
                thumbnail: mediaData.display_url
            };
        } else {
            return {
                type: "image",
                dimensions: mediaData.dimensions,
                url: mediaData.display_url
            };
        }
    } catch (err) {
        throw new Error(`Failed to format media details: ${err.message}`);
    }
}

function getShortcode(url) {
    try {
        let split_url = url.split("/");
        let post_tags = ["p", "reel", "tv", "reels"];
        let index_shortcode = split_url.findIndex(item => post_tags.includes(item)) + 1;
        let shortcode = split_url[index_shortcode];
        return shortcode;
    } catch (err) {
        throw new Error(`Failed to obtain shortcode: ${err.message}`);
    }
}

async function getCSRFToken() {
    try {
        let config = {
            method: 'GET',
            url: 'https://www.instagram.com/graphql/query/?doc_id=7950326061742207&variables=%7B%22id%22%3A%2259237287799%22%2C%22include_clips_attribution_info%22%3Afalse%2C%22first%22%3A12%7D',
        };

        const response = await axios.request(config);
        if (!response.headers['set-cookie']) {
            throw new Error('No CSRF token found');
        }
        
        const csrfCookie = response.headers['set-cookie'][0];
        const csrfToken = csrfCookie.split(";")[0].replace("csrftoken=", '');
        return csrfToken;
    } catch (err) {
        throw new Error(`Failed to obtain CSRF: ${err.message}`);
    }
}

function isSidecar(requestData) {
    try {
        return requestData["__typename"] == "XDTGraphSidecar";
    } catch (err) {
        throw new Error(`Failed sidecar verification: ${err.message}`);
    }
}

async function instagramRequest(shortcode, retries, delay) {
    try {
        const BASE_URL = "https://www.instagram.com/graphql/query";
        const INSTAGRAM_DOCUMENT_ID = "9510064595728286";
        let dataBody = qs.stringify({
            'variables': JSON.stringify({
                'shortcode': shortcode,
                'fetch_tagged_user_count': null,
                'hoisted_comment_id': null,
                'hoisted_reply_id': null
            }),
            'doc_id': INSTAGRAM_DOCUMENT_ID 
        });

        const token = await getCSRFToken();

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: BASE_URL,
            headers: {
                'X-CSRFToken': token,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: dataBody
        };
    
        const { data } = await axios.request(config);
        if (!data.data?.xdt_shortcode_media) {
            throw new Error("Only posts/reels supported, check if your link is valid.");
        }
        return data.data.xdt_shortcode_media;
    } catch (err) {
        const errorCodes = [429, 403];

        if (err.response && errorCodes.includes(err.response.status) && retries > 0) {
            const retryAfter = err.response.headers['retry-after'];
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
            await new Promise(res => setTimeout(res, waitTime));
            return instagramRequest(shortcode, retries - 1, delay * 2);
        }

        throw new Error(`Failed instagram request: ${err.message}`);
    }
}

function createOutputData(requestData) {
    try {
        let url_list = [], media_details = [];
        const IS_SIDECAR = isSidecar(requestData);
        
        if (IS_SIDECAR) {
            // Post with sidecar
            requestData.edge_sidecar_to_children.edges.forEach((media) => {
                media_details.push(formatMediaDetails(media.node));
                if (media.node.is_video) { // Sidecar video item
                    url_list.push(media.node.video_url);
                } else { // Sidecar image item
                    url_list.push(media.node.display_url);
                }
            });
        } else {
            // Post without sidecar
            media_details.push(formatMediaDetails(requestData));
            if (requestData.is_video) { // Video media
                url_list.push(requestData.video_url);
            } else { // Image media
                url_list.push(requestData.display_url);
            }
        }

        return {
            results_number: url_list.length,
            url_list,
            post_info: formatPostInfo(requestData),
            media_details
        };
    } catch (err) {
        throw new Error(`Failed to create output data: ${err.message}`);
    }
} 