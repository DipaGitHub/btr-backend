-- AI Tables Migration for BTR Communication AI Assistant

CREATE TABLE IF NOT EXISTS ai_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    status ENUM('active', 'completed', 'handoff_requested', 'archived') DEFAULT 'active',
    user_name VARCHAR(255) DEFAULT NULL,
    user_email VARCHAR(255) DEFAULT NULL,
    user_phone VARCHAR(50) DEFAULT NULL,
    company_name VARCHAR(255) DEFAULT NULL,
    business_type VARCHAR(255) DEFAULT NULL,
    project_type VARCHAR(255) DEFAULT NULL,
    project_description TEXT DEFAULT NULL,
    budget_range VARCHAR(100) DEFAULT NULL,
    timeline VARCHAR(100) DEFAULT NULL,
    preferred_contact_method VARCHAR(50) DEFAULT NULL,
    detected_service VARCHAR(255) DEFAULT NULL,
    intent VARCHAR(100) DEFAULT NULL,
    lead_score INT DEFAULT 0,
    lead_status ENUM('cold', 'warm', 'hot') DEFAULT 'cold',
    ai_summary TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_lead_status (lead_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    role ENUM('user', 'assistant', 'model', 'system', 'tool') NOT NULL,
    content TEXT DEFAULT NULL,
    tool_name VARCHAR(100) DEFAULT NULL,
    tool_call_id VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation_id (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN DEFAULT TRUE,
    bot_name VARCHAR(100) DEFAULT 'BTR AI Assistant',
    welcome_message TEXT DEFAULT NULL,
    enable_lead_capture BOOLEAN DEFAULT TRUE,
    enable_pricing_answers BOOLEAN DEFAULT TRUE,
    enable_portfolio_answers BOOLEAN DEFAULT TRUE,
    enable_faq_answers BOOLEAN DEFAULT TRUE,
    enable_human_handoff BOOLEAN DEFAULT TRUE,
    system_prompt_override TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
