// ============================================================
// nXuu — sync-trades Edge Function
// Receives full trade history from the MT4/5 EA, authenticates
// via per-user sync key, upserts trades keyed by (user_id, ticket).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type, x-sync-key',
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface IncomingTrade {
  ticket:       number;
  symbol:       string;
  direction:    'buy' | 'sell';
  entry_price:  number;
  exit_price:   number;
  lot_size:     number;
  pnl_usd:      number;
  open_time:    string;  // ISO timestamp
  close_time:   string;  // ISO timestamp
  account?:     string;  // optional MT account label
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const syncKey = req.headers.get('x-sync-key');
    if (!syncKey) {
      return new Response(JSON.stringify({ error: 'Missing x-sync-key header' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const trades: IncomingTrade[] = body.trades || [];
    if (!Array.isArray(trades) || trades.length === 0) {
      return new Response(JSON.stringify({ error: 'No trades provided' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // 1. Authenticate: hash the incoming key, look up matching user
    const keyHash = await sha256Hex(syncKey);
    const { data: keyRow, error: keyErr } = await supabase
      .from('sync_keys')
      .select('user_id')
      .eq('key_hash', keyHash)
      .single();

    if (keyErr || !keyRow) {
      return new Response(JSON.stringify({ error: 'Invalid sync key' }), { status: 401, headers: corsHeaders });
    }

    const userId = keyRow.user_id;

    // 2. Map incoming trades to our schema
    const rows = trades.map(t => {
      const pnl = Number(t.pnl_usd) || 0;
      return {
        user_id:      userId,
        source:       'api',
        ticket:       t.ticket,
        symbol:       t.symbol,
        direction:    t.direction,
        entry_price:  t.entry_price,
        exit_price:   t.exit_price,
        lot_size:     t.lot_size,
        pnl_usd:      pnl,
        result:       pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be',
        open_time:    t.open_time,
        close_time:   t.close_time,
        date:         (t.close_time || t.open_time || new Date().toISOString()).slice(0, 10),
      };
    });

    // 3. Upsert — only inserts new tickets, leaves existing rows (and their
    //    annotations) completely untouched via ignoreDuplicates.
    const { data, error } = await supabase
      .from('trades')
      .upsert(rows, { onConflict: 'user_id,ticket', ignoreDuplicates: true })
      .select('id');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      received: trades.length,
      inserted: data?.length || 0,
      skipped:  trades.length - (data?.length || 0),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
