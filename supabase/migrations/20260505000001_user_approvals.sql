-- Tabela de aprovação de usuários
CREATE TABLE IF NOT EXISTS user_approvals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email        text NOT NULL,
  approved     boolean DEFAULT false,
  admin        boolean DEFAULT false,
  approved_by  uuid REFERENCES auth.users(id),
  approved_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- Trigger: auto-insert ao criar usuário via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_approvals (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all" ON user_approvals
  USING (EXISTS (SELECT 1 FROM user_approvals ua WHERE ua.user_id = auth.uid() AND ua.admin = true));

CREATE POLICY "self_read" ON user_approvals FOR SELECT
  USING (user_id = auth.uid());

-- RLS nas tabelas operacionais (service_role bypassa automaticamente)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_read_leads" ON leads FOR ALL
  USING (EXISTS (SELECT 1 FROM user_approvals WHERE user_id = auth.uid() AND approved = true));

CREATE POLICY "approved_read_agents" ON agents FOR ALL
  USING (EXISTS (SELECT 1 FROM user_approvals WHERE user_id = auth.uid() AND approved = true));

CREATE POLICY "approved_read_call_results" ON call_results FOR ALL
  USING (EXISTS (SELECT 1 FROM user_approvals WHERE user_id = auth.uid() AND approved = true));

CREATE POLICY "approved_read_transcripts" ON transcripts FOR ALL
  USING (EXISTS (SELECT 1 FROM user_approvals WHERE user_id = auth.uid() AND approved = true));
