-- ============================================================
-- 🚀 MyHealthDB v1.2 - Complete Production Schema (FIXED)
-- ============================================================
-- خطوة 1: امسح كل حاجة موجودة (Safe Drop)
-- ============================================================

DROP TRIGGER IF EXISTS trg_audit_users_full ON users;
DROP TRIGGER IF EXISTS trg_audit_records_full ON medical_records;
DROP TRIGGER IF EXISTS trg_audit_system_settings_full ON system_settings;
DROP TRIGGER IF EXISTS trg_update_users ON users;
DROP TRIGGER IF EXISTS trg_update_records ON medical_records;
DROP TRIGGER IF EXISTS trg_update_appointments ON appointments;
DROP TRIGGER IF EXISTS trg_validate_appointment_time ON appointments;
DROP TRIGGER IF EXISTS trg_encrypt_medical_data ON medical_records;
DROP TRIGGER IF EXISTS trg_encrypt_password ON users;
DROP TRIGGER IF EXISTS trg_update_user_profile ON v_user_profile;
DROP TRIGGER IF EXISTS trg_create_audit_all_partition ON audit_logs_all;

DROP VIEW IF EXISTS v_user_profile CASCADE;
DROP VIEW IF EXISTS v_medical_records_decrypted CASCADE;

DROP TABLE IF EXISTS record_medications CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS medications CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS specializations CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS audit_logs_all CASCADE;

DROP FUNCTION IF EXISTS full_audit() CASCADE;
DROP FUNCTION IF EXISTS update_timestamp() CASCADE;
DROP FUNCTION IF EXISTS encrypt_medical_data() CASCADE;
DROP FUNCTION IF EXISTS encrypt_password() CASCADE;
DROP FUNCTION IF EXISTS update_user_profile() CASCADE;
DROP FUNCTION IF EXISTS validate_appointment_time() CASCADE;
DROP FUNCTION IF EXISTS create_monthly_audit_all_partition() CASCADE;

-- ============================================================
-- خطوة 2: Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================================
-- 🧱 1. TABLES
-- ============================================================

-- TABLE: specializations
CREATE TABLE specializations (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT
);

-- TABLE: users
CREATE TABLE users (
    id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name         TEXT      NOT NULL,
    email             TEXT      UNIQUE NOT NULL,
    phone             TEXT      UNIQUE NOT NULL,
    password_hash     TEXT      NOT NULL,
    role              TEXT      NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    specialization_id INT       REFERENCES specializations(id),
    date_of_birth     DATE,
    is_active         BOOLEAN   DEFAULT TRUE,
    is_deleted        BOOLEAN   DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW(),
    email_encrypted   BYTEA,
    phone_encrypted   BYTEA
);

-- TABLE: appointments
CREATE TABLE appointments (
    id               SERIAL    PRIMARY KEY,
    patient_id       UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id        UUID      NOT NULL REFERENCES users(id),
    appointment_time TIMESTAMP NOT NULL,
    duration_minutes INT       DEFAULT 30,
    status           TEXT      DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_patient_doctor_not_same CHECK (patient_id <> doctor_id)
);

-- TABLE: medical_records
CREATE TABLE medical_records (
    id                  SERIAL    PRIMARY KEY,
    patient_id          UUID      REFERENCES users(id) ON DELETE CASCADE,
    doctor_id           UUID      REFERENCES users(id),
    record_type         TEXT      CHECK (record_type IN ('diagnosis', 'prescription', 'test')),
    diagnosis           TEXT,
    notes               TEXT,
    is_deleted          BOOLEAN   DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    diagnosis_encrypted BYTEA,
    notes_encrypted     BYTEA
);

-- TABLE: medications
CREATE TABLE medications (
    id           SERIAL PRIMARY KEY,
    name         TEXT   NOT NULL,
    description  TEXT,
    dosage       TEXT,
    side_effects TEXT,
    created_at   TIMESTAMP DEFAULT NOW()
);

-- TABLE: record_medications (many-to-many) ✅ FIXED: record_id is INT
CREATE TABLE record_medications (
    record_id     INT  NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    medication_id INT  NOT NULL REFERENCES medications(id)     ON DELETE CASCADE,
    dosage        TEXT,
    duration_days INT,
    PRIMARY KEY (record_id, medication_id)
);

-- TABLE: notifications
CREATE TABLE notifications (
    id         SERIAL    PRIMARY KEY,
    user_id    UUID      NOT NULL REFERENCES users(id),
    message    TEXT      NOT NULL,
    is_read    BOOLEAN   DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TABLE: files
CREATE TABLE files (
    id          SERIAL PRIMARY KEY,
    record_id   INT    REFERENCES medical_records(id) ON DELETE CASCADE,
    file_url    TEXT   NOT NULL,
    file_type   TEXT   CHECK (file_type IN ('PDF', 'JPG', 'PNG', 'DICOM')),
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- TABLE: doctor_availability
CREATE TABLE doctor_availability (
    id          SERIAL    PRIMARY KEY,
    doctor_id   UUID      REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INT       NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time  TIME      NOT NULL,
    end_time    TIME      NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_doctor_day UNIQUE (doctor_id, day_of_week)
);

-- ============================================================
-- 📱 2. SYSTEM SETTINGS
-- ============================================================

CREATE TABLE system_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_settings (key, value) VALUES
    ('min_app_version_patient',  '1.0.0'),
    ('min_app_version_doctor',   '1.0.0'),
    ('update_link_android',      'https://play.google.com/store/apps/details?id=com.example.app'),
    ('update_link_ios',          'https://apps.apple.com/app/id123456'),
    ('maintenance_mode_enabled', 'false'),
    ('maintenance_message_ar',   'النظام في وضع الصيانة حاليا لتحسينات هامة. سنعود قريبا.'),
    ('maintenance_message_en',   'The system is currently under maintenance. We will be back shortly.'),
    ('telemedicine_enabled',     'true'),
    ('online_payment_enabled',   'true'),
    ('guest_registration_enabled','false'),
    ('session_timeout_minutes',  '60'),
    ('encryption_algorithm',     'AES-256'),
    ('security_level',           'high')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================
-- 🕵️ 3. AUDITING
-- ============================================================

CREATE TABLE audit_logs_all (
    id         BIGSERIAL NOT NULL,
    table_name TEXT      NOT NULL,
    operation  TEXT      NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMP NOT NULL DEFAULT now(),
    row_data   JSONB
) PARTITION BY RANGE (changed_at);

ALTER TABLE audit_logs_all ADD PRIMARY KEY (id, changed_at);

-- Create current month partition
DO $$
DECLARE
    partition_name TEXT;
    start_date     DATE;
    end_date       DATE;
BEGIN
    partition_name := 'audit_logs_all_' || to_char(NOW(), 'YYYY_MM');
    start_date     := date_trunc('month', NOW())::date;
    end_date       := (start_date + interval '1 month')::date;

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs_all
        FOR VALUES FROM (%L) TO (%L);
    ', partition_name, start_date, end_date);
END$$;

-- Auto-create future partitions
CREATE OR REPLACE FUNCTION create_monthly_audit_all_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_name TEXT;
    start_date     DATE;
    end_date       DATE;
BEGIN
    partition_name := 'audit_logs_all_' || to_char(NEW.changed_at, 'YYYY_MM');
    start_date     := date_trunc('month', NEW.changed_at)::date;
    end_date       := (start_date + interval '1 month')::date;

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs_all
        FOR VALUES FROM (%L) TO (%L);
    ', partition_name, start_date, end_date);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_audit_all_partition
BEFORE INSERT ON audit_logs_all
FOR EACH ROW EXECUTE FUNCTION create_monthly_audit_all_partition();

-- Safe audit function
CREATE OR REPLACE FUNCTION full_audit() RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    BEGIN
        SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
        INTO v_user_id;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    INSERT INTO audit_logs_all (table_name, operation, changed_by, row_data)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        v_user_id,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(NEW) END
    );

    IF (TG_OP = 'DELETE') THEN RETURN OLD;
    ELSE RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_users_full
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION full_audit();

CREATE TRIGGER trg_audit_records_full
AFTER INSERT OR UPDATE OR DELETE ON medical_records
FOR EACH ROW EXECUTE FUNCTION full_audit();

CREATE TRIGGER trg_audit_system_settings_full
AFTER INSERT OR UPDATE OR DELETE ON system_settings
FOR EACH ROW EXECUTE FUNCTION full_audit();

-- ============================================================
-- 🧰 4. TRIGGERS
-- ============================================================

-- 4.1 Auto update updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_users
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_update_records
BEFORE UPDATE ON medical_records
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_update_appointments
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 4.2 Auto encrypt medical data
CREATE OR REPLACE FUNCTION encrypt_medical_data()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.diagnosis IS NOT NULL THEN
        NEW.diagnosis_encrypted := pgp_sym_encrypt(
            NEW.diagnosis,
            current_setting('app.encryption_key'),
            'cipher-algo=aes256'
        );
        NEW.diagnosis := NULL;
    END IF;

    IF NEW.notes IS NOT NULL THEN
        NEW.notes_encrypted := pgp_sym_encrypt(
            NEW.notes,
            current_setting('app.encryption_key'),
            'cipher-algo=aes256'
        );
        NEW.notes := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_encrypt_medical_data
BEFORE INSERT OR UPDATE ON medical_records
FOR EACH ROW EXECUTE FUNCTION encrypt_medical_data();

-- 4.3 Auto encrypt password
CREATE OR REPLACE FUNCTION encrypt_password()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR
       (TG_OP = 'UPDATE' AND NEW.password_hash IS DISTINCT FROM OLD.password_hash)
    THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_encrypt_password
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION encrypt_password();

-- 4.4 Validate appointment time (no past booking)
CREATE OR REPLACE FUNCTION validate_appointment_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appointment_time < NOW() THEN
        RAISE EXCEPTION 'Appointment time cannot be in the past';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_appointment_time
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION validate_appointment_time();

-- ============================================================
-- 👤 SAFE PROFILE UPDATE VIEW
-- ============================================================

CREATE OR REPLACE VIEW v_user_profile AS
SELECT id, full_name, phone, date_of_birth
FROM users;

CREATE OR REPLACE FUNCTION update_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET
        full_name     = NEW.full_name,
        phone         = NEW.phone,
        date_of_birth = NEW.date_of_birth,
        updated_at    = NOW()
    WHERE id = NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_profile
INSTEAD OF UPDATE ON v_user_profile
FOR EACH ROW EXECUTE FUNCTION update_user_profile();

-- ============================================================
-- ⚡ 5. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email              ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone              ON users(phone);
CREATE INDEX IF NOT EXISTS idx_records_patient_id       ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_records_doctor_id        ON medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id   ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id  ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_type     ON medical_records(record_type);
CREATE INDEX IF NOT EXISTS idx_appointments_status_time ON appointments(status, appointment_time);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table         ON audit_logs_all(table_name);

-- ============================================================
-- 🔒 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              FORCE  ROW LEVEL SECURITY;
ALTER TABLE medical_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records    FORCE  ROW LEVEL SECURITY;
ALTER TABLE appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       FORCE  ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      FORCE  ROW LEVEL SECURITY;
ALTER TABLE files              ENABLE ROW LEVEL SECURITY;
ALTER TABLE files              FORCE  ROW LEVEL SECURITY;
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availability FORCE  ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY user_can_view_own_row ON users
FOR SELECT
USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY user_can_update_own_row ON users
FOR UPDATE
USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY admin_full_access_users ON users
FOR ALL
USING (current_setting('app.current_user_role', true) = 'admin')
WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- MEDICAL_RECORDS policies
CREATE POLICY patient_can_view_own_records ON medical_records
FOR SELECT
USING (patient_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY doctor_can_manage_patient_records ON medical_records
FOR ALL
USING (doctor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (doctor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY admin_full_access_records ON medical_records
FOR ALL
USING (current_setting('app.current_user_role', true) = 'admin')
WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- APPOINTMENTS policies
CREATE POLICY patient_can_manage_appointments ON appointments
FOR ALL
USING (patient_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (patient_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY doctor_can_manage_appointments ON appointments
FOR ALL
USING (doctor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (doctor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY admin_full_access_appointments ON appointments
FOR ALL
USING (current_setting('app.current_user_role', true) = 'admin')
WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- NOTIFICATIONS policies
CREATE POLICY user_can_manage_own_notifications ON notifications
FOR ALL
USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY admin_full_access_notifications ON notifications
FOR ALL
USING (current_setting('app.current_user_role', true) = 'admin')
WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- DOCTOR_AVAILABILITY policies
CREATE POLICY user_can_view_doctor_availability ON doctor_availability
FOR SELECT USING (true);

CREATE POLICY doctor_can_manage_availability ON doctor_availability
FOR ALL
USING (doctor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (doctor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY admin_full_access_availability ON doctor_availability
FOR ALL
USING (current_setting('app.current_user_role', true) = 'admin')
WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- FILES policies
CREATE POLICY user_can_access_files_via_records ON files
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM medical_records mr
        WHERE mr.id = files.record_id
          AND (
              mr.patient_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
           OR mr.doctor_id  = NULLIF(current_setting('app.current_user_id', true), '')::uuid
           OR current_setting('app.current_user_role', true) = 'admin'
          )
    )
);

CREATE POLICY admin_full_access_files ON files
FOR ALL
USING (current_setting('app.current_user_role', true) = 'admin')
WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- ============================================================
-- 👨‍💻 7. BACKEND USER & PRIVILEGES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'backend_user') THEN
        CREATE USER backend_user WITH PASSWORD 'CHANGE_ME_IN_PRODUCTION';
    END IF;
END$$;

REVOKE ALL ON DATABASE myhealth_db FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE myhealth_db TO backend_user;
GRANT USAGE   ON SCHEMA public         TO backend_user;

GRANT SELECT                           ON specializations     TO backend_user;
GRANT SELECT                           ON medications         TO backend_user;
GRANT SELECT, INSERT                   ON users               TO backend_user;
GRANT SELECT, INSERT, UPDATE, DELETE   ON appointments        TO backend_user;
GRANT SELECT, INSERT, UPDATE, DELETE   ON medical_records     TO backend_user;
GRANT SELECT, INSERT, UPDATE, DELETE   ON record_medications  TO backend_user;
GRANT SELECT, INSERT, UPDATE, DELETE   ON notifications       TO backend_user;
GRANT SELECT, INSERT, UPDATE, DELETE   ON files               TO backend_user;
GRANT SELECT, INSERT, UPDATE, DELETE   ON doctor_availability TO backend_user;
GRANT SELECT                           ON audit_logs_all      TO backend_user;
GRANT SELECT                           ON system_settings     TO backend_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO backend_user;

-- ============================================================
-- ⚙️ 8. DECRYPTED VIEW
-- ============================================================

CREATE OR REPLACE VIEW v_medical_records_decrypted AS
SELECT
    id,
    patient_id,
    doctor_id,
    pgp_sym_decrypt(diagnosis_encrypted, current_setting('app.encryption_key'))::text AS diagnosis,
    pgp_sym_decrypt(notes_encrypted,     current_setting('app.encryption_key'))::text AS notes,
    created_at,
    updated_at
FROM medical_records;

GRANT SELECT ON v_medical_records_decrypted TO backend_user;
GRANT SELECT ON v_user_profile              TO backend_user;
GRANT UPDATE ON v_user_profile              TO backend_user;

-- ============================================================
-- 🌱 9. SEED DATA (Test Data)
-- ============================================================

INSERT INTO specializations (name, description) VALUES
    ('Cardiology',       'Heart and cardiovascular system'),
    ('General Medicine', 'General health and wellness'),
    ('Pediatrics',       'Children health care'),
    ('Orthopedics',      'Bones and musculoskeletal system');

-- Doctor (password = 'password123' - سيتشفر تلقائياً بالـ trigger)
INSERT INTO users (id, full_name, email, phone, password_hash, role, specialization_id) VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        'Dr. Ahmed Mohamed',
        'dr.ahmed@elmostawsaf.com',
        '+201234567890',
        'password123',
        'doctor',
        1
    );

-- Patients
INSERT INTO users (id, full_name, email, phone, password_hash, role) VALUES
    ('00000000-0000-0000-0000-000000000002', 'Ahmed Mohamed',  'ahmed@patient.com',   '+201234567891', 'password123', 'patient'),
    ('00000000-0000-0000-0000-000000000003', 'Fatima Ali',     'fatima@patient.com',  '+201234567892', 'password123', 'patient'),
    ('00000000-0000-0000-0000-000000000004', 'Mahmoud Khaled', 'mahmoud@patient.com', '+201234567893', 'password123', 'patient'),
    ('00000000-0000-0000-0000-000000000005', 'Sara Ahmed',     'sara@patient.com',    '+201234567894', 'password123', 'patient'),
    ('00000000-0000-0000-0000-000000000006', 'Omar Hassan',    'omar@patient.com',    '+201234567895', 'password123', 'patient');

-- Appointments (كلها في المستقبل عشان الـ trigger ميرفضهاش)
INSERT INTO appointments (patient_id, doctor_id, appointment_time, duration_minutes, status, notes) VALUES
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '1 hour',  30, 'scheduled', 'Follow-up consultation'),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '2 hours', 30, 'scheduled', 'Emergency consultation'),
    ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '3 hours', 30, 'scheduled', 'Regular checkup'),
    ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '4 hours', 30, 'scheduled', 'Test results review'),
    ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '5 hours', 30, 'scheduled', 'Post-surgery follow-up');

-- ============================================================
-- ✅ Done! Schema created successfully.
-- ============================================================