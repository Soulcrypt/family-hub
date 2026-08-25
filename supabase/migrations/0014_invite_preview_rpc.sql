-- Task 14 fix round 3: /invite/[token] must not mutate anything during a plain GET render.
--
-- Every previous round of this task called accept_invite() directly from the page's render
-- path for a signed-in visitor -- a client component would never even get a chance to ask for
-- confirmation, because the claim had already happened by the time any HTML reached the
-- browser. That is a real product/security defect independent of everything fixed so far:
-- claiming is IRREVERSIBLE (household_invites.token_hash is single-use -- accept_invite sets
-- accepted_at and every subsequent call on that token raises 'invitation already used'), so
-- anything that triggers this RPC without the person's explicit intent permanently burns a
-- real invitation. The exposure isn't link-preview bots (they are never signed in, so they
-- only ever see the page's signed-out CTA branch, which never touches household_invites at
-- all) -- it's a signed-in recipient's OWN browser or client prefetching a hovered/visible
-- link and consuming the invitation before they ever decide to click it. This project's own
-- interface guidelines require confirmation before an irreversible action, never immediate
-- execution on render.
--
-- Fix: split "look at what this token points to" from "commit to it". This migration adds
-- preview_invite(text) -- read-only, no mutation, no advisory lock (nothing here needs one:
-- it changes no state, so two concurrent previews of the same token race nothing) -- so the
-- page can render a real confirmation screen ("Join The Rivera Family as Ivy?") from a plain
-- GET, and accept_invite itself now only ever runs from a Server Action triggered by an
-- explicit form submit (app/invite/[token]/actions.ts's confirmClaimAction).
--
-- preview_invite deliberately checks ONLY token validity (found, not yet used, not expired) --
-- the same three guards accept_invite itself leads with, and with the identical error text, so
-- an invalid token is rejected identically whichever RPC is asked about it. It deliberately
-- does NOT check anything about the CALLER (already a member, already has a household,
-- previously removed) -- those checks are about what happens if THIS SPECIFIC caller accepts,
-- and remain exclusively accept_invite's job, run only at submit time. A preview that showed
-- "you can't join this" before the caller ever presses the button would need to duplicate
-- accept_invite's entire guard surface just to decide what to render, and would immediately
-- drift out of sync with it; showing the confirmation screen and then rejecting the SUBMIT
-- with accept_invite's real, authoritative error is simpler, cannot drift, and is exactly the
-- shape every other error case in this flow already has ("render what it says, whenever it
-- says it").
--
-- No advisory lock, unlike accept_invite/create_household -- there is no TOCTOU window to
-- close when nothing is written.
create function preview_invite(p_token text)
  returns jsonb
  language plpgsql security definer set search_path = public, pg_temp, extensions as $$
  declare
    v_uid uuid := auth.uid();
    v_invite household_invites%rowtype;
    v_household_name text;
    v_member_name text;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;

    select * into v_invite from household_invites
    where token_hash = encode(digest(p_token, 'sha256'), 'hex');

    if v_invite.id is null then
      raise exception 'invitation not found' using errcode = '22023';
    end if;
    if v_invite.accepted_at is not null then
      raise exception 'invitation already used' using errcode = '22023';
    end if;
    if v_invite.expires_at < now() then
      raise exception 'invitation expired' using errcode = '22023';
    end if;

    select name into v_household_name from households where id = v_invite.household_id;

    if v_invite.member_id is not null then
      select display_name into v_member_name
      from household_members
      where id = v_invite.member_id and household_id = v_invite.household_id;
    end if;

    return jsonb_build_object('household_name', v_household_name, 'member_display_name', v_member_name);
  end;
  $$;

revoke execute on function preview_invite(text) from public;
grant  execute on function preview_invite(text) to authenticated;
