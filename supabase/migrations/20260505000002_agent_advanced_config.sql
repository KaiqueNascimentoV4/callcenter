ALTER TABLE agents ADD COLUMN IF NOT EXISTS vad_silencio_ms          integer DEFAULT 800;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS vad_sensibilidade_inicio  text    DEFAULT 'START_SENSITIVITY_LOW';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS vad_sensibilidade_fim     text    DEFAULT 'END_SENSITIVITY_LOW';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS interrupcao_habilitada    boolean DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS primeiro_turno_delay_ms   integer DEFAULT 500;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS silencio_encerrar_seg     integer DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deteccao_voicemail        boolean DEFAULT false;
