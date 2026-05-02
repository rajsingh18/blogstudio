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


DROP TABLE IF EXISTS password_resets;

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



-- Password reset tokens table (NEW - for token-based reset)
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
);

SHOW TABLES;

CREATE TABLE IF NOT EXISTS email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token)
);

-- Add bio column if not exists
ALTER TABLE users ADD COLUMN bio TEXT AFTER avatar;
CREATE DATABASE auth_system;
CREATE USER 'codecollab3'@'localhost' IDENTIFIED BY 'secure3password';
GRANT ALL PRIVILEGES ON auth_system.* TO 'codecollab3'@'localhost';
FLUSH PRIVILEGES;