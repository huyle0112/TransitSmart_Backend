const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');

// Configure storage to save to frontend/public/assets/avatar
const AVATAR_DIR = path.join(__dirname, '../../frontend/public/assets/avatar');

// Ensure directory exists
if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, AVATAR_DIR);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: userId-timestamp.ext
        const userId = req.user.sub;
        const ext = path.extname(file.originalname);
        const filename = `${userId}-${Date.now()}${ext}`;
        cb(null, filename);
    }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG, WebP)'), false);
    }
};

// Configure multer with 3MB limit
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 3 * 1024 * 1024 // 3MB in bytes
    }
});

/**
 * Upload user avatar
 * @route POST /api/upload/avatar
 * @access Protected
 */
exports.uploadAvatar = [
    upload.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    message: 'Vui lòng chọn file ảnh để upload.'
                });
            }

            const userId = req.user.sub;
            const avatarPath = `/assets/avatar/${req.file.filename}`;

            // Get old avatar path to delete old file
            const user = await prisma.users.findUnique({
                where: { id: userId },
                select: { path_url: true }
            });

            // Update user avatar path in database
            await prisma.users.update({
                where: { id: userId },
                data: { path_url: avatarPath }
            });

            // Delete old avatar file if exists
            if (user?.path_url && user.path_url.startsWith('/assets/avatar/')) {
                const oldFilePath = path.join(__dirname, '../../frontend/public', user.path_url);
                if (fs.existsSync(oldFilePath)) {
                    try {
                        fs.unlinkSync(oldFilePath);
                    } catch (err) {
                        console.error('Failed to delete old avatar:', err);
                    }
                }
            }

            res.json({
                message: 'Upload ảnh đại diện thành công!',
                avatarUrl: avatarPath
            });

        } catch (error) {
            // Delete uploaded file if database update fails
            if (req.file) {
                const filePath = path.join(AVATAR_DIR, req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            console.error('Avatar upload error:', error);

            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    message: 'File ảnh quá lớn. Kích thước tối đa 3MB.'
                });
            }

            res.status(500).json({
                message: error.message || 'Không thể upload ảnh. Vui lòng thử lại.'
            });
        }
    }
];
