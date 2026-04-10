import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PurchaseEntry {
  date: string;
  memo: string;
}

interface WinEntry {
  date: string;
  rank: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validatePurchases(arr: unknown): arr is PurchaseEntry[] {
  if (!Array.isArray(arr)) return false;
  return arr.every(
    (p) =>
      typeof p === "object" &&
      p !== null &&
      typeof p.date === "string" &&
      DATE_RE.test(p.date) &&
      typeof p.memo === "string" &&
      p.memo.length <= 200
  );
}

function validateWins(arr: unknown): arr is WinEntry[] {
  if (!Array.isArray(arr)) return false;
  return arr.every(
    (w) =>
      typeof w === "object" &&
      w !== null &&
      typeof w.date === "string" &&
      DATE_RE.test(w.date) &&
      typeof w.rank === "number" &&
      [1, 2, 3, 4, 5].includes(w.rank)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Parse body
    const body = await req.json();
    const { ticketId, purchases, wins } = body as {
      ticketId?: string;
      purchases?: unknown;
      wins?: unknown;
    };

    if (!ticketId || typeof ticketId !== "string") {
      return new Response(
        JSON.stringify({ error: "ticketId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate inputs
    const payload: Record<string, unknown> = {};

    if (purchases !== undefined) {
      if (!validatePurchases(purchases)) {
        return new Response(
          JSON.stringify({ error: "Invalid purchases format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      payload.purchases = purchases;
    }

    if (wins !== undefined) {
      if (!validateWins(wins)) {
        return new Response(
          JSON.stringify({ error: "Invalid wins format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      payload.wins = wins;
    }

    if (Object.keys(payload).length === 0) {
      return new Response(
        JSON.stringify({ error: "No fields to update" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Service-role client to bypass trigger
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify ownership
    const { data: ticket, error: fetchErr } = await serviceClient
      .from("tickets")
      .select("user_id")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (ticket.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update with service role (bypasses trigger)
    const { error: updateErr } = await serviceClient
      .from("tickets")
      .update(payload)
      .eq("id", ticketId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Update failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
