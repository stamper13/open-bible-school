begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

delete from public.obs_question_ladder_metadata metadata
using public.obs_biblical_books book
where metadata.book_code = book.book_code
  and book.testament = 'OT'
  and metadata.review_status in ('auto_accepted', 'needs_review')
  and metadata.metadata_source in ('payload', 'rule_inferred', 'hybrid');

alter table public.obs_question_ladder_metadata
  drop column if exists section_pair;

commit;
