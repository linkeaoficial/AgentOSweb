-- Índices para dedupe puntual de leads en el hot path (por mensaje de chat):
-- captureLead: WHERE agent_id = ? AND email = ? / AND phone = ?
-- handleLeadForm: mismo patrón
-- wantsForm:      WHERE agent_id = ? AND session_id = ?
CREATE INDEX IF NOT EXISTS idx_leads_email   ON leads(agent_id, email);
CREATE INDEX IF NOT EXISTS idx_leads_phone   ON leads(agent_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_session ON leads(agent_id, session_id);