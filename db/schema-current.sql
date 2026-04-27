--
-- PostgreSQL database dump
--

\restrict J09kaovlbXViJLt5y60aGZYRINeQjY0eJd1IGAxsZpP50ZPf4WBPwA37AqLnytl

-- Dumped from database version 17.9 (Ubuntu 17.9-0ubuntu0.25.10.1)
-- Dumped by pg_dump version 17.9 (Ubuntu 17.9-0ubuntu0.25.10.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    action_type character varying(50) NOT NULL,
    previous_value jsonb,
    new_value jsonb,
    user_id uuid,
    user_role character varying(50),
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now(),
    user_agent text,
    CONSTRAINT audit_log_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['add'::character varying, 'edit'::character varying, 'delete'::character varying, 'status_change'::character varying, 'override'::character varying, 'sign'::character varying, 'email_sent'::character varying, 'customer_accepted'::character varying, 'revision_request'::character varying, 'revision_response'::character varying, 'login'::character varying, 'view'::character varying])::text[])))
);


--
-- Name: contract_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    name character varying(255) NOT NULL,
    contract_body text,
    legal_terms text,
    default_term_months integer,
    created_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contract_id uuid,
    version_number integer NOT NULL,
    contract_body text,
    legal_terms text,
    changed_by uuid,
    change_summary text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contract_number integer NOT NULL,
    title character varying(500) NOT NULL,
    quote_id uuid,
    customer_id uuid,
    created_by uuid,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    start_date date,
    end_date date,
    auto_renew boolean DEFAULT false,
    renewal_terms text,
    contract_body text,
    legal_terms text,
    total_value numeric(12,2) DEFAULT 0,
    signed_by_customer boolean DEFAULT false,
    signed_by_admin boolean DEFAULT false,
    customer_signed_at timestamp with time zone,
    admin_signed_at timestamp with time zone,
    customer_signature_name character varying(255),
    admin_signature_name character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    org_id uuid,
    renewal_notified_6mo boolean DEFAULT false,
    renewal_notified_3mo boolean DEFAULT false,
    renewal_notified_1mo boolean DEFAULT false,
    term_months integer,
    legal_version integer,
    accepted_ip character varying(45),
    accepted_title character varying(255),
    accepted_company character varying(255),
    accepted_email character varying(255),
    accepted_phone character varying(100),
    accepted_address text,
    accepted_terms_agreed boolean DEFAULT false,
    pdf_path character varying(500),
    agreement_hash character varying(64),
    pdf_hash character varying(64),
    confirmation_email_sent_at timestamp with time zone,
    electronic_consent boolean DEFAULT false,
    esign_disclosure_accepted boolean DEFAULT false,
    billing_started_at timestamp with time zone,
    billing_started_by uuid,
    CONSTRAINT contracts_status_check CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Pending Signature'::character varying, 'Active'::character varying, 'Expired'::character varying, 'Terminated'::character varying, 'Amended'::character varying])::text[])))
);


--
-- Name: contracts_contract_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contracts_contract_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contracts_contract_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contracts_contract_number_seq OWNED BY public.contracts.contract_number;


--
-- Name: line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.line_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quote_id uuid,
    description text NOT NULL,
    quantity numeric(10,2) DEFAULT 1,
    unit_price numeric(12,2) NOT NULL,
    total_price numeric(12,2),
    total_override numeric(12,2),
    notes text,
    notes_visible_to_customer boolean DEFAULT false,
    editable_flag boolean DEFAULT true,
    is_locked boolean DEFAULT false,
    is_non_negotiable boolean DEFAULT false,
    is_informational boolean DEFAULT false,
    status character varying(50) DEFAULT 'Active'::character varying,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    category character varying(50),
    billing_cycle character varying(20) DEFAULT 'one_time'::character varying,
    is_discount boolean DEFAULT false,
    applies_to_line_item_id uuid,
    created_by_role character varying(50),
    CONSTRAINT line_items_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Modified'::character varying, 'Pending Revision'::character varying, 'Locked'::character varying])::text[])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    domains text[] DEFAULT '{}'::text[],
    logo_url character varying(500),
    primary_color character varying(20),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    category character varying(50) NOT NULL,
    description character varying(255) NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    term_months integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    is_default_item boolean DEFAULT true,
    discount_at_term integer,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    detail_text text
);


--
-- Name: quote_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_access_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quote_id uuid,
    contract_id uuid,
    token character varying(128) NOT NULL,
    email character varying(255) NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone,
    access_count integer DEFAULT 0
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quote_number integer NOT NULL,
    title character varying(500) NOT NULL,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    customer_id uuid,
    created_by uuid,
    assigned_editor uuid,
    subtotal numeric(12,2) DEFAULT 0,
    total_override numeric(12,2),
    total numeric(12,2) DEFAULT 0,
    legal_terms text,
    notes text,
    valid_until date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    org_id uuid,
    term_months integer,
    customer_name character varying(255),
    customer_email character varying(255),
    customer_phone character varying(100),
    customer_company character varying(255),
    customer_address text,
    legal_version integer,
    accepted_at timestamp with time zone,
    accepted_ip character varying(45),
    accepted_name character varying(255),
    accepted_title character varying(255),
    accepted_company character varying(255),
    accepted_email character varying(255),
    accepted_phone character varying(100),
    accepted_address text,
    accepted_terms_agreed boolean DEFAULT false,
    verification_code character varying(6),
    verification_code_expires_at timestamp with time zone,
    email_verified_at timestamp with time zone,
    electronic_consent boolean DEFAULT false,
    esign_disclosure_accepted boolean DEFAULT false,
    CONSTRAINT quotes_status_check CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Sent'::character varying, 'Revised'::character varying, 'Pending Revision'::character varying, 'Ready for Acceptance'::character varying, 'Accepted'::character varying, 'Declined'::character varying, 'Expired'::character varying])::text[])))
);


--
-- Name: quotes_quote_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quotes_quote_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotes_quote_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quotes_quote_number_seq OWNED BY public.quotes.quote_number;


--
-- Name: revision_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revision_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quote_id uuid,
    line_item_id uuid,
    requested_by uuid,
    responded_by uuid,
    request_message text NOT NULL,
    response_message text,
    status character varying(50) DEFAULT 'Open'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    CONSTRAINT revision_requests_status_check CHECK (((status)::text = ANY ((ARRAY['Open'::character varying, 'Resolved'::character varying, 'Closed'::character varying])::text[])))
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: user_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_organizations (
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    full_name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'customer'::character varying NOT NULL,
    company character varying(255),
    phone character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    google_id character varying(255),
    microsoft_id character varying(255),
    org_id uuid,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['domain_admin'::character varying, 'editor'::character varying, 'customer'::character varying])::text[])))
);


--
-- Name: contracts contract_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts ALTER COLUMN contract_number SET DEFAULT nextval('public.contracts_contract_number_seq'::regclass);


--
-- Name: quotes quote_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes ALTER COLUMN quote_number SET DEFAULT nextval('public.quotes_quote_number_seq'::regclass);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: contract_templates contract_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_pkey PRIMARY KEY (id);


--
-- Name: contract_versions contract_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_versions
    ADD CONSTRAINT contract_versions_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: line_items line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.line_items
    ADD CONSTRAINT line_items_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: quote_access_tokens quote_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_access_tokens
    ADD CONSTRAINT quote_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: quote_access_tokens quote_access_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_access_tokens
    ADD CONSTRAINT quote_access_tokens_token_key UNIQUE (token);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: revision_requests revision_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: user_organizations user_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_pkey PRIMARY KEY (user_id, org_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_contract_versions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_versions ON public.contract_versions USING btree (contract_id);


--
-- Name: idx_contracts_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_customer ON public.contracts USING btree (customer_id);


--
-- Name: idx_contracts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_org ON public.contracts USING btree (org_id);


--
-- Name: idx_contracts_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_quote ON public.contracts USING btree (quote_id);


--
-- Name: idx_contracts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_status ON public.contracts USING btree (status);


--
-- Name: idx_line_items_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_line_items_quote ON public.line_items USING btree (quote_id);


--
-- Name: idx_quotes_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_customer ON public.quotes USING btree (customer_id);


--
-- Name: idx_quotes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_org ON public.quotes USING btree (org_id);


--
-- Name: idx_quotes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_status ON public.quotes USING btree (status);


--
-- Name: idx_revision_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revision_quote ON public.revision_requests USING btree (quote_id);


--
-- Name: idx_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_expire ON public.session USING btree (expire);


--
-- Name: idx_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token ON public.quote_access_tokens USING btree (token);


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_google_id ON public.users USING btree (google_id);


--
-- Name: idx_users_microsoft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_microsoft_id ON public.users USING btree (microsoft_id);


--
-- Name: idx_users_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_org ON public.users USING btree (org_id);


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: contract_templates contract_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: contract_versions contract_versions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_versions
    ADD CONSTRAINT contract_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: contract_versions contract_versions_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_versions
    ADD CONSTRAINT contract_versions_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_billing_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_billing_started_by_fkey FOREIGN KEY (billing_started_by) REFERENCES public.users(id);


--
-- Name: contracts contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: contracts contracts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: contracts contracts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: contracts contracts_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: line_items line_items_applies_to_line_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.line_items
    ADD CONSTRAINT line_items_applies_to_line_item_id_fkey FOREIGN KEY (applies_to_line_item_id) REFERENCES public.line_items(id) ON DELETE SET NULL;


--
-- Name: line_items line_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.line_items
    ADD CONSTRAINT line_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: pricing_rules pricing_rules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: quote_access_tokens quote_access_tokens_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_access_tokens
    ADD CONSTRAINT quote_access_tokens_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id);


--
-- Name: quote_access_tokens quote_access_tokens_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_access_tokens
    ADD CONSTRAINT quote_access_tokens_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: quotes quotes_assigned_editor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_assigned_editor_fkey FOREIGN KEY (assigned_editor) REFERENCES public.users(id);


--
-- Name: quotes quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: quotes quotes_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: revision_requests revision_requests_line_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_line_item_id_fkey FOREIGN KEY (line_item_id) REFERENCES public.line_items(id) ON DELETE SET NULL;


--
-- Name: revision_requests revision_requests_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: revision_requests revision_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: revision_requests revision_requests_responded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES public.users(id);


--
-- Name: user_organizations user_organizations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- PostgreSQL database dump complete
--

\unrestrict J09kaovlbXViJLt5y60aGZYRINeQjY0eJd1IGAxsZpP50ZPf4WBPwA37AqLnytl

