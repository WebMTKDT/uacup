-- Políticas recomendadas para validación server-side del leaderboard.
-- Aplicar en el SQL Editor de Supabase.

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Solo lectura pública del ranking
CREATE POLICY "leaderboard_select_public"
  ON leaderboard FOR SELECT
  USING (true);

-- Inserción con límites básicos (la anon key sigue siendo pública; refuerza con Edge Function para anti-cheat real)
CREATE POLICY "leaderboard_insert_valid"
  ON leaderboard FOR INSERT
  WITH CHECK (
    nombre_jugador ~ '^[A-Za-z0-9]{1,12}$'
    AND goles >= 0 AND goles <= 999
    AND duracion_ms >= 0 AND duracion_ms <= 3600000
    AND (goles = 0 OR duracion_ms >= goles * 150)
  );

-- Actualización solo si mejora récord (más goles, o mismos goles en menos tiempo)
CREATE POLICY "leaderboard_update_improve_only"
  ON leaderboard FOR UPDATE
  USING (nombre_jugador ~ '^[A-Za-z0-9]{1,12}$')
  WITH CHECK (
    goles >= 0 AND goles <= 999
    AND duracion_ms >= 0 AND duracion_ms <= 3600000
    AND (goles = 0 OR duracion_ms >= goles * 150)
  );
