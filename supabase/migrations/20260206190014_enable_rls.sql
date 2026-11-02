-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Create policies for read-only access (public)
CREATE POLICY "Allow public read access to teams" ON teams
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read access to players" ON players
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read access to contracts" ON contracts
    FOR SELECT TO anon, authenticated USING (true);

-- Note: Write policies should be added based on authentication/authorization requirements