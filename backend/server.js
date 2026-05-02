const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadDir = './uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: fileFilter
});

// MySQL Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'codecollab3',
    password: process.env.DB_PASSWORD || 'secure3password',
    database: process.env.DB_NAME || 'auth_system',
    port: process.env.DB_PORT || 3306
});

// Helper function to format date
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
};

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('✅ Connected to MySQL database');
    
    // Create users table
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(100),
            bio TEXT,
            avatar VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    
    db.query(createUsersTable, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('✅ Users table ready');
        }
    });
    
    // Create password reset tokens table
    const createResetTokensTable = `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token (token),
            INDEX idx_email (email),
            INDEX idx_expires_at (expires_at)
        )
    `;
    
    db.query(createResetTokensTable, (err) => {
        if (err) {
            console.error('Error creating password_reset_tokens table:', err);
        } else {
            console.log('✅ Password reset tokens table ready');
        }
    });
    
    // Create blogs table
    const createBlogsTable = `
        CREATE TABLE IF NOT EXISTS blogs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            excerpt VARCHAR(500),
            featured_image VARCHAR(500),
            category VARCHAR(100),
            tags VARCHAR(500),
            status ENUM('draft', 'published') DEFAULT 'published',
            views INT DEFAULT 0,
            likes_count INT DEFAULT 0,
            comments_count INT DEFAULT 0,
            reports_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    
    db.query(createBlogsTable, (err) => {
        if (err) {
            console.error('Error creating blogs table:', err);
        } else {
            console.log('✅ Blogs table ready');
        }
    });
    
    // Create blog_likes table
    const createLikesTable = `
        CREATE TABLE IF NOT EXISTS blog_likes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            blog_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_like (blog_id, user_id),
            INDEX idx_blog_id (blog_id),
            INDEX idx_user_id (user_id)
        )
    `;
    
    db.query(createLikesTable, (err) => {
        if (err) {
            console.error('Error creating blog_likes table:', err);
        } else {
            console.log('✅ Blog likes table ready');
        }
    });
    
    // Create blog_comments table
    const createCommentsTable = `
        CREATE TABLE IF NOT EXISTS blog_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            blog_id INT NOT NULL,
            user_id INT NOT NULL,
            parent_id INT NULL,
            content TEXT NOT NULL,
            likes_count INT DEFAULT 0,
            status ENUM('approved', 'pending', 'spam') DEFAULT 'approved',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE,
            INDEX idx_blog_id (blog_id),
            INDEX idx_user_id (user_id),
            INDEX idx_parent_id (parent_id)
        )
    `;
    
    db.query(createCommentsTable, (err) => {
        if (err) {
            console.error('Error creating blog_comments table:', err);
        } else {
            console.log('✅ Blog comments table ready');
        }
    });
    
    // Create comment_likes table
    const createCommentLikesTable = `
        CREATE TABLE IF NOT EXISTS comment_likes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            comment_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (comment_id) REFERENCES blog_comments(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_comment_like (comment_id, user_id)
        )
    `;
    
    db.query(createCommentLikesTable, (err) => {
        if (err) {
            console.error('Error creating comment_likes table:', err);
        } else {
            console.log('✅ Comment likes table ready');
        }
    });
    
    // Create saved_posts table
    const createSavedPostsTable = `
        CREATE TABLE IF NOT EXISTS saved_posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            blog_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_saved (blog_id, user_id),
            INDEX idx_user_id (user_id)
        )
    `;
    
    db.query(createSavedPostsTable, (err) => {
        if (err) {
            console.error('Error creating saved_posts table:', err);
        } else {
            console.log('✅ Saved posts table ready');
        }
    });
    
    // Create blog_reports table
    const createReportsTable = `
        CREATE TABLE IF NOT EXISTS blog_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            blog_id INT NOT NULL,
            reported_by INT NOT NULL,
            reason VARCHAR(255) NOT NULL,
            description TEXT,
            status ENUM('pending', 'reviewed', 'dismissed') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
            FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_report (blog_id, reported_by)
        )
    `;
    
    db.query(createReportsTable, (err) => {
        if (err) {
            console.error('Error creating reports table:', err);
        } else {
            console.log('✅ Blog reports table ready');
        }
    });
    
    // Create blog_views table
    const createViewsTable = `
        CREATE TABLE IF NOT EXISTS blog_views (
            id INT AUTO_INCREMENT PRIMARY KEY,
            blog_id INT NOT NULL,
            viewer_id INT NULL,
            ip_address VARCHAR(45),
            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
            INDEX idx_blog_id (blog_id)
        )
    `;
    
    db.query(createViewsTable, (err) => {
        if (err) {
            console.error('Error creating views table:', err);
        } else {
            console.log('✅ Blog views table ready');
        }
    });
    
    // Create hidden_reports table
    const createHiddenReportsTable = `
        CREATE TABLE IF NOT EXISTS hidden_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            blog_id INT NOT NULL,
            hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
            UNIQUE KEY unique_hidden (user_id, blog_id),
            INDEX idx_user_id (user_id),
            INDEX idx_blog_id (blog_id)
        )
    `;
    
    db.query(createHiddenReportsTable, (err) => {
        if (err) {
            console.error('Error creating hidden_reports table:', err);
        } else {
            console.log('✅ Hidden reports table ready');
        }
    });
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this_in_production';

// Configure email transporter
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your_email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your_app_password'
    }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// ==================== IMAGE UPLOAD ====================
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const imageUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${req.file.filename}`;
    res.json({ 
        success: true, 
        imageUrl: imageUrl,
        filename: req.file.filename,
        message: 'Image uploaded successfully'
    });
});

// ==================== AUTHENTICATION ====================
app.post('/api/register', async (req, res) => {
    const { username, email, password, full_name } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please provide username, email and password' 
        });
    }
    
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], async (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length > 0) {
            const existingUser = results[0];
            if (existingUser.username === username) {
                return res.status(400).json({ success: false, message: 'Username already taken' });
            }
            if (existingUser.email === email) {
                return res.status(400).json({ success: false, message: 'Email already registered' });
            }
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertQuery = 'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)';
        db.query(insertQuery, [username, email, hashedPassword, full_name || null], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error creating user' });
            }
            
            const token = jwt.sign({ id: result.insertId, username }, JWT_SECRET, { expiresIn: '7d' });
            
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                token,
                user: {
                    id: result.insertId,
                    username,
                    email,
                    full_name: full_name || null
                }
            });
        });
    });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please provide username and password' 
        });
    }
    
    const query = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(query, [username, username], async (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials. Please register first.' 
            });
        }
        
        const user = results[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials. Please check your password.' 
            });
        }
        
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name
            }
        });
    });
});

app.post('/api/verify', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

// ==================== PASSWORD RESET ====================

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ success: false, message: 'Please provide your email address' });
    }
    
    const query = 'SELECT id, username, email FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'No account found with this email address' });
        }
        
        res.json({
            success: true,
            message: 'Email verified. Please reset your password.',
            email: email
        });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword, confirmPassword } = req.body;
    
    if (!email || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    
    const query = 'SELECT id FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'No account found with this email' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updateQuery = 'UPDATE users SET password = ? WHERE email = ?';
        db.query(updateQuery, [hashedPassword, email], (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error updating password' });
            }
            
            res.json({
                success: true,
                message: 'Password reset successful! You can now login with your new password.'
            });
        });
    });
});

// ==================== BLOG POSTS ====================

app.post('/api/blogs', authenticateToken, (req, res) => {
    const { title, content, excerpt, featured_image, category, tags, status } = req.body;
    const user_id = req.user.id;
    
    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Title and content are required' });
    }
    
    const query = `INSERT INTO blogs (user_id, title, content, excerpt, featured_image, category, tags, status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(query, [user_id, title, content, excerpt || null, featured_image || null, category || null, tags || null, status || 'published'], 
        (err, result) => {
            if (err) {
                console.error('Error creating blog:', err);
                return res.status(500).json({ success: false, message: 'Error creating blog post' });
            }
            
            res.json({ success: true, message: 'Blog post created successfully', blogId: result.insertId });
        });
});

// GET - Get all published blog posts
app.get('/api/blogs', (req, res) => {
    const userId = req.query.userId || null;
    
    let query = `
        SELECT b.*, u.username, u.full_name, u.avatar,
               COUNT(DISTINCT bl.id) as likes_count,
               COUNT(DISTINCT bc.id) as comments_count,
               EXISTS(SELECT 1 FROM blog_likes WHERE blog_id = b.id AND user_id = ?) as is_liked
        FROM blogs b
        JOIN users u ON b.user_id = u.id
        LEFT JOIN blog_likes bl ON b.id = bl.blog_id
        LEFT JOIN blog_comments bc ON b.id = bc.blog_id AND bc.status = 'approved'
        WHERE b.status = 'published'
    `;
    
    const params = [userId || null];
    
    if (userId) {
        query += ` AND b.id NOT IN (SELECT blog_id FROM hidden_reports WHERE user_id = ?)`;
        params.push(userId);
    }
    
    query += ` GROUP BY b.id ORDER BY b.created_at DESC`;
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error fetching blogs:', err);
            return res.status(500).json({ success: false, message: 'Error fetching blogs' });
        }
        
        const blogs = results.map(blog => ({
            ...blog,
            tags: blog.tags ? blog.tags.split(',') : [],
            is_liked: blog.is_liked === 1
        }));
        
        res.json({ success: true, blogs });
    });
});

// GET - Get user's draft posts
app.get('/api/drafts', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    const query = `
        SELECT * FROM blogs 
        WHERE user_id = ? AND status = 'draft'
        ORDER BY updated_at DESC
    `;
    
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching drafts:', err);
            return res.status(500).json({ success: false, message: 'Error fetching draft posts' });
        }
        
        const drafts = results.map(draft => ({
            ...draft,
            tags: draft.tags ? draft.tags.split(',') : []
        }));
        
        res.json({ success: true, drafts });
    });
});

// PUT - Publish a draft
app.put('/api/drafts/:id/publish', authenticateToken, (req, res) => {
    const draftId = req.params.id;
    const userId = req.user.id;
    
    const checkQuery = 'SELECT user_id FROM blogs WHERE id = ? AND status = "draft"';
    db.query(checkQuery, [draftId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Draft not found' });
        }
        
        if (results[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        const updateQuery = 'UPDATE blogs SET status = "published", updated_at = NOW() WHERE id = ?';
        db.query(updateQuery, [draftId], (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error publishing draft' });
            }
            
            res.json({ success: true, message: 'Draft published successfully!' });
        });
    });
});

// GET - Get single blog post
app.get('/api/blogs/:id', (req, res) => {
    const blogId = req.params.id;
    const viewerId = req.query.userId || null;
    const viewerIp = req.ip;
    
    if (viewerId) {
        const checkHiddenQuery = 'SELECT * FROM hidden_reports WHERE user_id = ? AND blog_id = ?';
        db.query(checkHiddenQuery, [viewerId, blogId], (err, hiddenResults) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            if (hiddenResults.length > 0) {
                return res.status(404).json({ success: false, message: 'Blog not found' });
            }
            
            getBlogAndTrack();
        });
    } else {
        getBlogAndTrack();
    }
    
    function getBlogAndTrack() {
        const query = `
            SELECT b.*, u.username, u.full_name, u.avatar,
                   EXISTS(SELECT 1 FROM blog_likes WHERE blog_id = b.id AND user_id = ?) as is_liked,
                   COUNT(DISTINCT bl.id) as total_likes,
                   COUNT(DISTINCT bc.id) as total_comments
            FROM blogs b
            JOIN users u ON b.user_id = u.id
            LEFT JOIN blog_likes bl ON b.id = bl.blog_id
            LEFT JOIN blog_comments bc ON b.id = bc.blog_id AND bc.status = 'approved'
            WHERE b.id = ?
            GROUP BY b.id
        `;
        
        db.query(query, [viewerId || null, blogId], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error fetching blog' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ success: false, message: 'Blog not found' });
            }
            
            const blog = {
                ...results[0],
                tags: results[0].tags ? results[0].tags.split(',') : [],
                is_liked: results[0].is_liked === 1
            };
            
            const trackViewQuery = `INSERT INTO blog_views (blog_id, viewer_id, ip_address) VALUES (?, ?, ?)`;
            db.query(trackViewQuery, [blogId, viewerId || null, viewerIp]);
            
            const updateViewsQuery = `UPDATE blogs SET views = views + 1 WHERE id = ?`;
            db.query(updateViewsQuery, [blogId]);
            
            res.json({ success: true, blog });
        });
    }
});

// UPDATE - Edit blog post
app.put('/api/blogs/:id', authenticateToken, (req, res) => {
    const { title, content, excerpt, featured_image, category, tags, status } = req.body;
    const blogId = req.params.id;
    const userId = req.user.id;
    
    const checkQuery = 'SELECT user_id FROM blogs WHERE id = ?';
    db.query(checkQuery, [blogId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Blog not found' });
        }
        
        if (results[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        const updateQuery = `
            UPDATE blogs 
            SET title = ?, content = ?, excerpt = ?, featured_image = ?, 
                category = ?, tags = ?, status = ?, updated_at = NOW()
            WHERE id = ?
        `;
        
        const tagsValue = Array.isArray(tags) ? tags.join(',') : tags;
        
        db.query(updateQuery, [title, content, excerpt, featured_image, category, tagsValue, status, blogId], 
            (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error updating blog' });
                }
                
                res.json({ success: true, message: 'Blog updated successfully' });
            });
    });
});

// DELETE - Remove blog post
app.delete('/api/blogs/:id', authenticateToken, (req, res) => {
    const blogId = req.params.id;
    const userId = req.user.id;
    
    const checkQuery = 'SELECT user_id FROM blogs WHERE id = ?';
    db.query(checkQuery, [blogId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Blog not found' });
        }
        
        if (results[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        db.query('DELETE FROM blogs WHERE id = ?', [blogId], (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error deleting blog' });
            }
            
            res.json({ success: true, message: 'Blog deleted successfully' });
        });
    });
});

// ==================== LIKE SYSTEM ====================

app.post('/api/blogs/:id/like', authenticateToken, (req, res) => {
    const blogId = req.params.id;
    const userId = req.user.id;
    
    const checkLikeQuery = 'SELECT * FROM blog_likes WHERE blog_id = ? AND user_id = ?';
    db.query(checkLikeQuery, [blogId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length > 0) {
            const deleteQuery = 'DELETE FROM blog_likes WHERE blog_id = ? AND user_id = ?';
            db.query(deleteQuery, [blogId, userId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error removing like' });
                }
                
                const updateCountQuery = 'UPDATE blogs SET likes_count = likes_count - 1 WHERE id = ?';
                db.query(updateCountQuery, [blogId]);
                
                res.json({ success: true, liked: false, message: 'Like removed' });
            });
        } else {
            const insertQuery = 'INSERT INTO blog_likes (blog_id, user_id) VALUES (?, ?)';
            db.query(insertQuery, [blogId, userId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error adding like' });
                }
                
                const updateCountQuery = 'UPDATE blogs SET likes_count = likes_count + 1 WHERE id = ?';
                db.query(updateCountQuery, [blogId]);
                
                res.json({ success: true, liked: true, message: 'Blog liked!' });
            });
        }
    });
});

app.get('/api/blogs/:id/like-status', authenticateToken, (req, res) => {
    const blogId = req.params.id;
    const userId = req.user.id;
    
    const query = 'SELECT * FROM blog_likes WHERE blog_id = ? AND user_id = ?';
    db.query(query, [blogId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        res.json({ success: true, liked: results.length > 0 });
    });
});

// ==================== SAVE SYSTEM ====================

app.post('/api/blogs/:id/save', authenticateToken, (req, res) => {
    const blogId = req.params.id;
    const userId = req.user.id;
    
    const checkSaveQuery = 'SELECT * FROM saved_posts WHERE blog_id = ? AND user_id = ?';
    db.query(checkSaveQuery, [blogId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length > 0) {
            const deleteQuery = 'DELETE FROM saved_posts WHERE blog_id = ? AND user_id = ?';
            db.query(deleteQuery, [blogId, userId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error removing from saved' });
                }
                
                res.json({ success: true, saved: false, message: 'Removed from saved posts' });
            });
        } else {
            const insertQuery = 'INSERT INTO saved_posts (blog_id, user_id) VALUES (?, ?)';
            db.query(insertQuery, [blogId, userId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error saving post' });
                }
                
                res.json({ success: true, saved: true, message: 'Post saved!' });
            });
        }
    });
});

app.get('/api/saved-posts', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    const query = `
        SELECT b.*, u.username, u.full_name,
               EXISTS(SELECT 1 FROM blog_likes WHERE blog_id = b.id AND user_id = ?) as is_liked
        FROM saved_posts sp
        JOIN blogs b ON sp.blog_id = b.id
        JOIN users u ON b.user_id = u.id
        WHERE sp.user_id = ?
        ORDER BY sp.created_at DESC
    `;
    
    db.query(query, [userId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching saved posts' });
        }
        
        const savedPosts = results.map(post => ({
            ...post,
            tags: post.tags ? post.tags.split(',') : [],
            is_liked: post.is_liked === 1
        }));
        
        res.json({ success: true, savedPosts });
    });
});

app.get('/api/blogs/:id/save-status', authenticateToken, (req, res) => {
    const blogId = req.params.id;
    const userId = req.user.id;
    
    const query = 'SELECT * FROM saved_posts WHERE blog_id = ? AND user_id = ?';
    db.query(query, [blogId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        res.json({ success: true, saved: results.length > 0 });
    });
});

// ==================== COMMENT SYSTEM ====================

app.get('/api/blogs/:id/comments', (req, res) => {
    const blogId = req.params.id;
    const userId = req.query.userId || null;
    
    const query = `
        SELECT c.*, u.username, u.full_name, u.avatar,
               EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as is_liked,
               COUNT(cl.id) as likes_count,
               (SELECT COUNT(*) FROM blog_comments WHERE parent_id = c.id AND status = 'approved') as reply_count
        FROM blog_comments c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN comment_likes cl ON c.id = cl.comment_id
        WHERE c.blog_id = ? AND c.status = 'approved' AND c.parent_id IS NULL
        GROUP BY c.id
        ORDER BY c.created_at DESC
    `;
    
    db.query(query, [userId || null, blogId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching comments' });
        }
        
        res.json({ success: true, comments: results });
    });
});

app.get('/api/comments/:id/replies', (req, res) => {
    const commentId = req.params.id;
    const userId = req.query.userId || null;
    
    const query = `
        SELECT c.*, u.username, u.full_name, u.avatar,
               EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as is_liked,
               COUNT(cl.id) as likes_count
        FROM blog_comments c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN comment_likes cl ON c.id = cl.comment_id
        WHERE c.parent_id = ? AND c.status = 'approved'
        GROUP BY c.id
        ORDER BY c.created_at ASC
    `;
    
    db.query(query, [userId || null, commentId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching replies' });
        }
        
        res.json({ success: true, replies: results });
    });
});

app.post('/api/blogs/:id/comments', authenticateToken, (req, res) => {
    const blogId = req.params.id;
    const userId = req.user.id;
    const { content, parentId } = req.body;
    
    if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }
    
    const insertQuery = `
        INSERT INTO blog_comments (blog_id, user_id, parent_id, content) 
        VALUES (?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [blogId, userId, parentId || null, content.trim()], (err, result) => {
        if (err) {
            console.error('Error adding comment:', err);
            return res.status(500).json({ success: false, message: 'Error adding comment' });
        }
        
        const updateCountQuery = 'UPDATE blogs SET comments_count = comments_count + 1 WHERE id = ?';
        db.query(updateCountQuery, [blogId]);
        
        const getCommentQuery = `
            SELECT c.*, u.username, u.full_name, u.avatar,
                   0 as likes_count, 0 as reply_count, FALSE as is_liked
            FROM blog_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `;
        
        db.query(getCommentQuery, [result.insertId], (err, commentResults) => {
            if (err) {
                return res.json({ success: true, message: 'Comment added successfully' });
            }
            
            res.json({ 
                success: true, 
                message: 'Comment added successfully',
                comment: commentResults[0]
            });
        });
    });
});

app.post('/api/comments/:id/like', authenticateToken, (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.id;
    
    const checkLikeQuery = 'SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?';
    db.query(checkLikeQuery, [commentId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length > 0) {
            const deleteQuery = 'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?';
            db.query(deleteQuery, [commentId, userId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error removing like' });
                }
                
                const updateCountQuery = 'UPDATE blog_comments SET likes_count = likes_count - 1 WHERE id = ?';
                db.query(updateCountQuery, [commentId]);
                
                res.json({ success: true, liked: false, message: 'Like removed' });
            });
        } else {
            const insertQuery = 'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)';
            db.query(insertQuery, [commentId, userId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error adding like' });
                }
                
                const updateCountQuery = 'UPDATE blog_comments SET likes_count = likes_count + 1 WHERE id = ?';
                db.query(updateCountQuery, [commentId]);
                
                res.json({ success: true, liked: true, message: 'Comment liked!' });
            });
        }
    });
});

app.delete('/api/comments/:id', authenticateToken, (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.id;
    
    const checkQuery = 'SELECT user_id, blog_id FROM blog_comments WHERE id = ?';
    db.query(checkQuery, [commentId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }
        
        if (results[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        const blogId = results[0].blog_id;
        
        db.query('DELETE FROM blog_comments WHERE id = ?', [commentId], (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error deleting comment' });
            }
            
            const updateCountQuery = `
                UPDATE blogs b 
                SET comments_count = (SELECT COUNT(*) FROM blog_comments WHERE blog_id = ? AND status = 'approved')
                WHERE id = ?
            `;
            db.query(updateCountQuery, [blogId, blogId]);
            
            res.json({ success: true, message: 'Comment deleted successfully' });
        });
    });
});

// ==================== REPORT SYSTEM ====================

app.post('/api/blogs/:id/report', authenticateToken, (req, res) => {
    const blogId = req.params.id;
    const reportedBy = req.user.id;
    const { reason, description } = req.body;
    
    if (!reason) {
        return res.status(400).json({ success: false, message: 'Please provide a reason for reporting' });
    }
    
    const checkBlogQuery = 'SELECT id, title, user_id FROM blogs WHERE id = ?';
    db.query(checkBlogQuery, [blogId], (err, blogResults) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (blogResults.length === 0) {
            return res.status(404).json({ success: false, message: 'Blog not found' });
        }
        
        const checkReportQuery = 'SELECT * FROM blog_reports WHERE blog_id = ? AND reported_by = ?';
        db.query(checkReportQuery, [blogId, reportedBy], (err, reportResults) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            if (reportResults.length > 0) {
                return res.status(400).json({ success: false, message: 'You have already reported this blog' });
            }
            
            const insertReportQuery = `INSERT INTO blog_reports (blog_id, reported_by, reason, description) VALUES (?, ?, ?, ?)`;
            db.query(insertReportQuery, [blogId, reportedBy, reason, description || null], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error submitting report' });
                }
                
                const updateReportsQuery = `UPDATE blogs SET reports_count = reports_count + 1 WHERE id = ?`;
                db.query(updateReportsQuery, [blogId]);
                
                const hideBlogQuery = `INSERT INTO hidden_reports (user_id, blog_id) VALUES (?, ?)`;
                db.query(hideBlogQuery, [reportedBy, blogId], (err) => {
                    if (err) {
                        console.error('Error hiding blog for user:', err);
                    }
                    
                    res.json({ 
                        success: true, 
                        message: 'Report submitted successfully. This blog has been hidden from your view.' 
                    });
                });
            });
        });
    });
});

app.get('/api/blogs/:id/report-status', authenticateToken, (req, res) => {
    const blogId = req.params.id;
    const userId = req.user.id;
    
    const query = 'SELECT * FROM blog_reports WHERE blog_id = ? AND reported_by = ?';
    db.query(query, [blogId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        res.json({ success: true, hasReported: results.length > 0 });
    });
});

// ==================== ANALYTICS DASHBOARD ====================

app.get('/api/analytics', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    const blogsQuery = `
        SELECT id, title, views, likes_count, comments_count, created_at 
        FROM blogs 
        WHERE user_id = ? AND status = 'published'
        ORDER BY created_at DESC
    `;
    
    db.query(blogsQuery, [userId], (err, blogs) => {
        if (err) {
            console.error('Error fetching blogs for analytics:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        const viewsQuery = `
            SELECT 
                DATE(viewed_at) as date,
                COUNT(*) as daily_views,
                COUNT(DISTINCT blog_id) as blogs_viewed
            FROM blog_views
            WHERE viewer_id IS NOT NULL 
                AND blog_id IN (SELECT id FROM blogs WHERE user_id = ?)
                AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(viewed_at)
            ORDER BY date ASC
        `;
        
        db.query(viewsQuery, [userId], (err, viewsData) => {
            if (err) {
                console.error('Error fetching view analytics:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            const likesQuery = `
                SELECT 
                    DATE(bl.created_at) as date,
                    COUNT(*) as daily_likes
                FROM blog_likes bl
                WHERE bl.blog_id IN (SELECT id FROM blogs WHERE user_id = ?)
                    AND bl.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(bl.created_at)
                ORDER BY date ASC
            `;
            
            db.query(likesQuery, [userId], (err, likesData) => {
                if (err) {
                    console.error('Error fetching likes analytics:', err);
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                
                const topBlogsQuery = `
                    SELECT id, title, views, likes_count, comments_count, created_at
                    FROM blogs 
                    WHERE user_id = ? AND status = 'published'
                    ORDER BY views DESC, likes_count DESC
                    LIMIT 5
                `;
                
                db.query(topBlogsQuery, [userId], (err, topBlogs) => {
                    if (err) {
                        console.error('Error fetching top blogs:', err);
                        return res.status(500).json({ success: false, message: 'Database error' });
                    }
                    
                    const totalViews = blogs.reduce((sum, blog) => sum + (blog.views || 0), 0);
                    const totalLikes = blogs.reduce((sum, blog) => sum + (blog.likes_count || 0), 0);
                    const totalComments = blogs.reduce((sum, blog) => sum + (blog.comments_count || 0), 0);
                    
                    res.json({
                        success: true,
                        analytics: {
                            blogs: blogs,
                            totalBlogs: blogs.length,
                            totalViews: totalViews,
                            totalLikes: totalLikes,
                            totalComments: totalComments,
                            viewsData: viewsData,
                            likesData: likesData,
                            topBlogs: topBlogs
                        }
                    });
                });
            });
        });
    });
});

// ==================== EXPORT POSTS (Public - Anyone can export) ====================

// GET - Export blog content as Markdown (Public - no authentication required)
app.get('/api/export-blog/:id/markdown', (req, res) => {
    const blogId = req.params.id;
    
    const query = `
        SELECT b.*, u.username, u.full_name 
        FROM blogs b
        JOIN users u ON b.user_id = u.id
        WHERE b.id = ? AND b.status = 'published'
    `;
    
    db.query(query, [blogId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Blog not found' });
        }
        
        const blog = results[0];
        
        let markdown = `# ${blog.title}\n\n`;
        markdown += `> **Author:** ${blog.full_name || blog.username}\n`;
        markdown += `> **Date:** ${formatDate(blog.created_at)}\n`;
        markdown += `> **Category:** ${blog.category || 'Uncategorized'}\n`;
        markdown += `> **Views:** ${blog.views || 0} | **Likes:** ${blog.likes_count || 0}\n\n`;
        markdown += `---\n\n`;
        
        if (blog.featured_image) {
            markdown += `![Featured Image](${blog.featured_image})\n\n`;
        }
        
        markdown += blog.content;
        
        if (blog.tags) {
            markdown += `\n\n---\n\n**Tags:** ${blog.tags.split(',').map(tag => `\`${tag.trim()}\``).join(', ')}\n`;
        }
        
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${blog.title.replace(/[^a-z0-9]/gi, '_')}.md"`);
        res.send(markdown);
    });
});

// GET - Export blog content as HTML (Public - no authentication required)
app.get('/api/export-blog/:id/html', (req, res) => {
    const blogId = req.params.id;
    
    const query = `
        SELECT b.*, u.username, u.full_name 
        FROM blogs b
        JOIN users u ON b.user_id = u.id
        WHERE b.id = ? AND b.status = 'published'
    `;
    
    db.query(query, [blogId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Blog not found' });
        }
        
        const blog = results[0];
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${blog.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 { color: #1a1a2e; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
        h2 { color: #16213e; margin-top: 30px; }
        .meta {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
        }
        .featured-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 20px 0;
        }
        .tags {
            margin-top: 30px;
            padding: 10px;
            background: #f9f9f9;
            border-radius: 8px;
        }
        .tag {
            display: inline-block;
            background: #e0e0e0;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin: 4px;
        }
        footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <article>
        <h1>${blog.title}</h1>
        
        <div class="meta">
            <strong>Author:</strong> ${blog.full_name || blog.username}<br>
            <strong>Date:</strong> ${formatDate(blog.created_at)}<br>
            <strong>Category:</strong> ${blog.category || 'Uncategorized'}<br>
            <strong>Views:</strong> ${blog.views || 0} | <strong>Likes:</strong> ${blog.likes_count || 0}
        </div>
        
        ${blog.featured_image ? `<img src="${blog.featured_image}" alt="${blog.title}" class="featured-image">` : ''}
        
        <div class="content">
            ${blog.content.split('\n').map(para => `<p>${para}</p>`).join('')}
        </div>
        
        ${blog.tags ? `
        <div class="tags">
            <strong>Tags:</strong>
            ${blog.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
        </div>
        ` : ''}
    </article>
    <footer>
        <p>Exported from Blog Studio</p>
    </footer>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="${blog.title.replace(/[^a-z0-9]/gi, '_')}.html"`);
        res.send(html);
    });
});

// GET - Export all user blogs as JSON (Authenticated - only for own blogs)
app.get('/api/export-all-blogs', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    const query = `
        SELECT id, title, content, created_at, views, likes_count, comments_count
        FROM blogs 
        WHERE user_id = ? AND status = 'published'
        ORDER BY created_at DESC
    `;
    
    db.query(query, [userId], (err, blogs) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            totalBlogs: blogs.length,
            blogs: blogs.map(blog => ({
                id: blog.id,
                title: blog.title,
                content: blog.content,
                created_at: blog.created_at,
                views: blog.views,
                likes: blog.likes_count,
                comments: blog.comments_count
            }))
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="all_blog_posts.json"`);
        res.send(JSON.stringify(exportData, null, 2));
    });
});

// ==================== VIEW STATISTICS ====================

app.get('/api/blogs/:id/views', (req, res) => {
    const blogId = req.params.id;
    
    const query = `
        SELECT 
            COUNT(*) as total_views,
            COUNT(DISTINCT viewer_id) as unique_viewers,
            DATE(viewed_at) as date,
            COUNT(*) as daily_views
        FROM blog_views
        WHERE blog_id = ?
        GROUP BY DATE(viewed_at)
        ORDER BY date DESC
        LIMIT 30
    `;
    
    db.query(query, [blogId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching view statistics' });
        }
        res.json({ success: true, statistics: results });
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
    console.log(`🔗 API URL: http://localhost:${PORT}`);
    console.log(`\n📊 Analytics Endpoint:`);
    console.log(`   GET /api/analytics - Get analytics dashboard data`);
    console.log(`\n📄 Export Endpoints (Public - anyone can export):`);
    console.log(`   GET /api/export-blog/:id/markdown - Export blog as Markdown`);
    console.log(`   GET /api/export-blog/:id/html - Export blog as HTML`);
    console.log(`   GET /api/export-all-blogs - Export all your blogs as JSON (Auth required)`);
});