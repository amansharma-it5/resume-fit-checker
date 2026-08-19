begin;
select plan(14);

insert into auth.users(id, email) values ('10000000-0000-0000-0000-000000000001', 'one@example.invalid'), ('20000000-0000-0000-0000-000000000002', 'two@example.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.resumes(id, title) values ('11000000-0000-0000-0000-000000000001', 'User one resume');
select is((select count(*)::integer from public.resumes), 1, 'owner can read own resume');
select lives_ok($$update public.resumes set title = 'Renamed' where id = '11000000-0000-0000-0000-000000000001'$$, 'owner can update own resume');
select lives_ok($$select public.import_guest_resumes('[{"source_guest_id":"12000000-0000-0000-0000-000000000001","title":"Guest","structured_data":{"sections":[]}}]'::jsonb)$$, 'owner can import guest data');
select is((select count(*)::integer from public.resumes where source_guest_id = '12000000-0000-0000-0000-000000000001'), 1, 'guest import creates one row');
select lives_ok($$select public.import_guest_resumes('[{"source_guest_id":"12000000-0000-0000-0000-000000000001","title":"Guest","structured_data":{"sections":[]}}]'::jsonb)$$, 'guest import is retry safe');
select is((select count(*)::integer from public.resumes where source_guest_id = '12000000-0000-0000-0000-000000000001'), 1, 'retry does not duplicate data');

set local request.jwt.claims = '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.resumes), 0, 'second user cannot read first user records');
select lives_ok($$update public.resumes set title = 'Stolen'$$, 'second user update statement is harmless');
select is((select count(*)::integer from public.resumes where title = 'Stolen'), 0, 'second user cannot update first user records');
select throws_ok($$insert into public.resume_sections(resume_id, section_type, heading, position) values ('11000000-0000-0000-0000-000000000001', 'skills', 'Skills', 0)$$, '23503', null, 'second user cannot attach a child record to first user resume');
select throws_ok($$insert into public.resumes(owner_id, title) values ('10000000-0000-0000-0000-000000000001', 'Forged')$$, '42501', null, 'second user cannot forge ownership');

set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.resumes set status = 'deleted', deleted_at = timezone('utc', now()) where id = '11000000-0000-0000-0000-000000000001';
select lives_ok($$select public.permanently_delete_resume('11000000-0000-0000-0000-000000000001')$$, 'owner can permanently delete a soft-deleted resume');
select is((select count(*)::integer from public.resumes where id = '11000000-0000-0000-0000-000000000001'), 0, 'permanent delete removed owned resume');

reset role;
select has_table('public', 'data_deletion_jobs', 'account data job table exists');
select * from finish();
rollback;
