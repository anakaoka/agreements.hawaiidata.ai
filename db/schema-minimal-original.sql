CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'customer' CHECK (role IN ('domain_admin', 'editor', 'customer')),
    company VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number SERIAL,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Revised', 'Pending Revision', 'Ready for Acceptance', 'Accepted', 'Declined', 'Expired')),
    customer_id UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    assigned_editor UUID REFERENCES users(id),
    subtotal NUMERIC(12,2) DEFAULT 0,
    total_override NUMERIC(12,2),
    total NUMERIC(12,2) DEFAULT 0,
    legal_terms TEXT,
    notes TEXT,
    valid_until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2),
    total_override NUMERIC(12,2),
    notes TEXT,
    notes_visible_to_customer BOOLEAN DEFAULT false,
    editable_flag BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    is_non_negotiable BOOLEAN DEFAULT false,
    is_informational BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Modified', 'Pending Revision', 'Locked')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('add', 'edit', 'delete', 'override', 'status_change', 'login', 'logout')),
    previous_value JSONB,
    new_value JSONB,
    user_id UUID REFERENCES users(id),
    user_role VARCHAR(50),
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE revision_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    line_item_id UUID REFERENCES line_items(id) ON DELETE SET NULL,
    requested_by UUID REFERENCES users(id),
    responded_by UUID REFERENCES users(id),
    request_message TEXT NOT NULL,
    response_message TEXT,
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Resolved', 'Closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE session (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (sid)
);
CREATE INDEX idx_session_expire ON session(expire);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_line_items_quote ON line_items(quote_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_revision_quote ON revision_requests(quote_id);
