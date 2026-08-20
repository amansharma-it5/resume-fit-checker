alter table public.resumes add constraint resumes_id_owner_unique unique (id, owner_id);
alter table public.resume_sections add constraint resume_sections_id_owner_unique unique (id, owner_id);
alter table public.job_descriptions add constraint job_descriptions_id_owner_unique unique (id, owner_id);
alter table public.cover_letters add constraint cover_letters_id_owner_unique unique (id, owner_id);
alter table public.interview_sessions add constraint interview_sessions_id_owner_unique unique (id, owner_id);
alter table public.interview_questions add constraint interview_questions_id_owner_unique unique (id, owner_id);
alter table public.job_bookmarks add constraint job_bookmarks_id_owner_unique unique (id, owner_id);

alter table public.resume_sections add constraint resume_sections_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete cascade;
alter table public.resume_versions add constraint resume_versions_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete cascade;
alter table public.resume_job_targets add constraint targets_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete cascade;
alter table public.resume_job_targets add constraint targets_owned_job_fk foreign key (job_description_id, owner_id) references public.job_descriptions(id, owner_id) on delete cascade;
alter table public.analyses add constraint analyses_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete cascade;
alter table public.analyses add constraint analyses_owned_job_fk foreign key (job_description_id, owner_id) references public.job_descriptions(id, owner_id) on delete set null (job_description_id);
alter table public.user_confirmed_facts add constraint facts_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete cascade;
alter table public.user_confirmed_facts add constraint facts_owned_section_fk foreign key (source_section_id, owner_id) references public.resume_sections(id, owner_id) on delete set null (source_section_id);
alter table public.ai_generations add constraint generations_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete cascade;
alter table public.cover_letters add constraint cover_letters_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete set null (resume_id);
alter table public.cover_letters add constraint cover_letters_owned_job_fk foreign key (job_description_id, owner_id) references public.job_descriptions(id, owner_id) on delete set null (job_description_id);
alter table public.interview_sessions add constraint sessions_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete set null (resume_id);
alter table public.interview_sessions add constraint sessions_owned_job_fk foreign key (job_description_id, owner_id) references public.job_descriptions(id, owner_id) on delete set null (job_description_id);
alter table public.interview_questions add constraint questions_owned_session_fk foreign key (session_id, owner_id) references public.interview_sessions(id, owner_id) on delete cascade;
alter table public.interview_answers add constraint answers_owned_question_fk foreign key (question_id, owner_id) references public.interview_questions(id, owner_id) on delete cascade;
alter table public.job_bookmarks add constraint bookmarks_owned_job_fk foreign key (job_description_id, owner_id) references public.job_descriptions(id, owner_id) on delete set null (job_description_id);
alter table public.job_applications add constraint applications_owned_bookmark_fk foreign key (job_bookmark_id, owner_id) references public.job_bookmarks(id, owner_id) on delete set null (job_bookmark_id);
alter table public.job_applications add constraint applications_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete set null (resume_id);
alter table public.job_applications add constraint applications_owned_cover_fk foreign key (cover_letter_id, owner_id) references public.cover_letters(id, owner_id) on delete set null (cover_letter_id);
alter table public.review_requests add constraint reviews_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete cascade;
alter table public.export_history add constraint exports_owned_resume_fk foreign key (resume_id, owner_id) references public.resumes(id, owner_id) on delete set null (resume_id);

drop trigger immutable_resume_versions on public.resume_versions;
create trigger immutable_resume_versions before update on public.resume_versions for each row execute function public.prevent_resume_version_mutation();

comment on constraint resume_sections_owned_resume_fk on public.resume_sections is 'Prevents a user-owned child record from referencing another user''s resume.';
