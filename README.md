# 📝 Blog Studio - Complete Blog Platform

A full-featured blog platform with authentication, CRUD operations, comments system, likes, saved posts, analytics dashboard, and export functionality.

## ✨ Features

### Core Features
- 🔐 **User Authentication** - Register/Login with JWT
- 📝 **Blog CRUD** - Create, Read, Update, Delete blog posts
- 🖼️ **Image Upload** - Upload featured images for posts
- 📂 **Drafts System** - Save posts as drafts and publish later
- 🔍 **Search & Filter** - Search by title, content, or tags
- 📚 **Categories** - Organize posts by categories

### Engagement Features
- ❤️ **Like System** - Like/unlike blog posts
- 💬 **Comments System** - Nested comments with replies
- 👍 **Comment Likes** - Like comments
- 🔖 **Save Posts** - Bookmark posts for later reading

### Analytics & Export
- 📊 **Analytics Dashboard** - View total views, likes, comments, and charts
- 📈 **Daily Statistics** - Views and likes over last 30 days
- 📄 **Export Posts** - Export as Markdown, HTML, or JSON
- 🏆 **Top Performing Blogs** - See your most popular content

### UI/UX
- 🌓 **Dark/Light Mode** - Toggle between themes
- 📱 **Fully Responsive** - Works on mobile, tablet, and desktop
- 🎨 **Beautiful Animations** - Smooth transitions and effects
- 🎯 **Modern Design** - Tailwind CSS with gradient effects

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI Framework
- **Tailwind CSS** - Styling
- **Axios** - API calls
- **date-fns** - Date formatting

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MySQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Multer** - File uploads

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/blog-platform.git
cd blog-platform

for backend 
run: node server.js 

for frontend
run: npm start

CREATE DATABASE auth_system;
USE auth_system;

-- Table will be created automatically by the server
-- But you can manually create it with:
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);




select * from users;
select * from blogs;
select * from blog_likes;
select * from blog_comments;
select * from comment_likes;
select * from saved_posts;


-- Run all queries together
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
);

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
    INDEX idx_parent_id (parent_id),
    INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS comment_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    comment_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES blog_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_comment_like (comment_id, user_id),
    INDEX idx_comment_id (comment_id),
    INDEX idx_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS saved_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blog_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_saved (blog_id, user_id),
    INDEX idx_blog_id (blog_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Add likes_count column to blogs table
ALTER TABLE blogs ADD COLUMN likes_count INT DEFAULT 0;

-- Add comments_count column to blogs table
ALTER TABLE blogs ADD COLUMN comments_count INT DEFAULT 0;

ALTER TABLE users ADD COLUMN avatar VARCHAR(500) AFTER full_name;
ALTER TABLE blogs ADD COLUMN reports_count INT DEFAULT 0;


SHOW TABLES;


-- Add bio column if not exists
ALTER TABLE users ADD COLUMN bio TEXT AFTER avatar;
CREATE DATABASE auth_system;
CREATE USER 'codecollab3'@'localhost' IDENTIFIED BY 'secure3password';
GRANT ALL PRIVILEGES ON auth_system.* TO 'codecollab3'@'localhost';
FLUSH PRIVILEGES;
